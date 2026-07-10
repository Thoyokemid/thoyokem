import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    role: string;
    permissions: {
      dashboard: boolean;
      attendance: boolean;
      leave: boolean;
      registration_request: boolean;
      setting: boolean;
      staff: boolean;
    };
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      permissions: {
        dashboard: boolean;
        attendance: boolean;
        leave: boolean;
        registration_request: boolean;
        setting: boolean;
        staff: boolean;
      };
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    permissions: {
      dashboard: boolean;
      attendance: boolean;
      leave: boolean;
      registration_request: boolean;
      setting: boolean;
      staff: boolean;
    };
  }
}