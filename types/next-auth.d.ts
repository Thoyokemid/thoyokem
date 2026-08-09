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
  }
}
