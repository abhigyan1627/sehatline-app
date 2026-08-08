# SehatLine Admin authorization

The Admin Panel has no public registration. The first Super Admin is created from the trusted project terminal; every later administrator is created by a logged-in Super Admin.

## Required environment

Copy `.env.example` to `.env.local` and set a unique `ADMIN_JWT_SECRET` with at least 32 random characters. Never commit `.env.local`.

Generate a suitable secret in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Create the first Super Admin

In PowerShell, from the project directory:

```powershell
npm.cmd run admin:setup
```

The command generates and saves a dedicated `ADMIN_JWT_SECRET` when needed, then securely asks for the owner's full name, email, mobile number and hidden password. It generates the next ID in the `SL-ADMIN-001` format. The supplied password is immediately bcrypt-hashed and is never written to source code or logs. The account must choose a new permanent password on first login.

## Create additional administrators

1. Open `/admin/login` and sign in as the Super Admin.
2. Complete the mandatory password change if this is the first login.
3. Open **Admin Management**.
4. Select **Create admin**, enter contact details, choose a role and permissions.
5. Copy the generated Admin ID and one-time temporary password from the one-time credentials panel.
6. Share the credentials through a secure channel. The password cannot be viewed again.

Disabling an account or resetting its password revokes every active session. A reset generates a new temporary password and forces another password change.

## Create a Receptionist account

1. Verify the doctor first, then open **Admin Management** as the Super Admin.
2. Create a team member with the **Receptionist** role.
3. Select one or more verified doctors under **Assigned verified doctors**.
4. Give the generated Staff ID and one-time password to the receptionist through a secure channel.
5. The receptionist opens `/receptionist/` and must create a private password on first login.

Receptionists receive only Dashboard, Live Queue and Patient Management permissions. The backend fixes these permissions and rejects unverified or unassigned doctor access even if a browser request is manually changed.

## Security model

- Passwords use bcrypt with cost 12.
- The browser receives an HttpOnly, SameSite=Strict cookie; tokens are not placed in local or session storage.
- JWT expiry is tied to a revocable persisted session and administrator token version.
- State-changing calls require a per-session CSRF token and same-origin request.
- Five failed attempts in fifteen minutes trigger a temporary cooldown.
- Backend permissions are checked for every protected admin API.
- Receptionist clinic data is restricted to the doctor IDs assigned by the Owner.
- Sensitive actions are added to the audit log without passwords, cookies, JWTs or CSRF tokens.
