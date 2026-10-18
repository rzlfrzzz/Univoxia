declare module 'bcryptjs' {
  export function hashSync(data: string, saltOrRounds: number): string;
  export function hash(data: string, saltOrRounds: number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}
