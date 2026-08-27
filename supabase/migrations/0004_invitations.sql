-- Invitations: asking someone before seating them.
--
-- Two functions, and they differ in a way that matters.
--
-- invite_to_seat is SECURITY INVOKER. The caller is an org member acting on
-- their own project, so ordinary RLS is exactly the right check — the same
-- one a raw insert from them would face. It is a function only for atomicity:
-- creating the invitation and marking the seat 'invited' must not half-happen.
--
-- respond_to_invitation is SECURITY DEFINER, and has to be. The recipient may
-- have no account at all — that is the entire point of a link that works
-- before you sign up — so they have no permission to read the invitation, the
-- seat, or the person row that describes them. The token *is* the
-- authorisation here, the same way it is in every invitation email ever sent.

create or replace function public.invite_to_seat(
  p_role_id uuid,
  p_person_id uuid,
  p_token text,
  p_message text default null
) returns uuid
language plpgsql
as $$
declare
  v_seat_id uuid;
  v_invitation_id uuid;
begin
  select id into v_seat_id from seats where role_id = p_role_id;
  if v_seat_id is null then
    raise exception 'No seat exists for that role.';
  end if;

  insert into invitations (seat_id, person_id, invited_by, token, message)
  values (v_seat_id, p_person_id, auth.uid(), p_token, p_message)
  returning id into v_invitation_id;

  -- The seat is spoken for, but not filled. Someone still has to say yes.
  update seats
     set person_id = p_person_id,
         state = 'invited',
         filled_at = null
   where id = v_seat_id;

  return v_invitation_id;
end;
$$;

create or replace function public.respond_to_invitation(
  p_token text,
  p_accept boolean
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv invitations%rowtype;
  v_seat seats%rowtype;
begin
  select * into v_inv from invitations where token = p_token;

  if v_inv.id is null then
    return 'not_found';
  end if;

  if v_inv.status <> 'pending' then
    -- Already accepted, declined, or revoked. Deliberately not an error:
    -- people re-open old links, and telling them what already happened is
    -- more useful than a failure.
    return 'already_' || v_inv.status;
  end if;

  if v_inv.expires_at < now() then
    update invitations set status = 'expired' where id = v_inv.id;
    -- Reopen the seat: an expired invitation should not hold a chair forever.
    update seats set person_id = null, state = 'open', filled_at = null
     where id = v_inv.seat_id and state = 'invited';
    return 'expired';
  end if;

  select * into v_seat from seats where id = v_inv.seat_id;

  -- The seat may have been filled by someone else while this invitation sat
  -- unanswered. Accepting must not silently evict them.
  if p_accept and v_seat.state = 'filled' and v_seat.person_id is distinct from v_inv.person_id then
    update invitations set status = 'revoked', responded_at = now() where id = v_inv.id;
    return 'seat_taken';
  end if;

  if p_accept then
    update seats
       set person_id = v_inv.person_id, state = 'filled', filled_at = now()
     where id = v_inv.seat_id;
    update invitations set status = 'accepted', responded_at = now() where id = v_inv.id;
    return 'accepted';
  else
    -- A decline reopens the seat. This is the moment the engine gets to
    -- re-rank against the team as it now stands.
    update seats
       set person_id = null, state = 'open', filled_at = null
     where id = v_inv.seat_id;
    update invitations set status = 'declined', responded_at = now() where id = v_inv.id;
    return 'declined';
  end if;
end;
$$;

revoke execute on function public.invite_to_seat(uuid, uuid, text, text) from public, anon;
grant execute on function public.invite_to_seat(uuid, uuid, text, text) to authenticated;

-- Responding is open to anonymous callers on purpose: the recipient clicks a
-- link, possibly without an account. The unguessable token is the credential.
grant execute on function public.respond_to_invitation(text, boolean) to anon, authenticated;
