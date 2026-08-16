import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    role: string;
    role_id: string;
    permissions: {
      dashboard: boolean;
      attendance: boolean;
      leave: boolean;
      registration_request: boolean;
      setting: boolean;
      staff: boolean;
      inventory: boolean;
      purchasing: boolean;
      sales_order: boolean;
      delivery_order: boolean;
      can_approve: boolean;
    };
    isSuperAdmin: boolean;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      role_id: string;
      permissions: {
        dashboard: boolean;
        attendance: boolean;
        leave: boolean;
        registration_request: boolean;
        setting: boolean;
        staff: boolean;
        inventory: boolean;
        purchasing: boolean;
        sales_order: boolean;
        delivery_order: boolean;
        can_approve: boolean;
      };
      isSuperAdmin: boolean;
      sessionInvalid?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    role_id: string;
    permissions: {
      dashboard: boolean;
      attendance: boolean;
      leave: boolean;
      registration_request: boolean;
      setting: boolean;
      staff: boolean;
      inventory: boolean;
      purchasing: boolean;
      sales_order: boolean;
      delivery_order: boolean;
      can_approve: boolean;
    };
    isSuperAdmin: boolean;
    // Set when the underlying `users` row for this token's id can no longer be
    // found (e.g. deleted, or its id was rewritten by a data migration) — lets
    // the app cleanly force a re-login instead of crashing on undefined data.
    sessionInvalid?: boolean;
  }
}
