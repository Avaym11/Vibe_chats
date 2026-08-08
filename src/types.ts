export interface UserPayload {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  vibe_tag?: string;
  status_message?: string;
}

export interface AuthRequest extends Express.Request {
  user?: UserPayload;
}
