/* Every language opens its kicker, label and announcements with its word for
   "simulation": that is the disclosure, and the tests hold each one to it. */
export interface Texts {
  kicker: string;
  label: string;
  cta: string;
  agents: (count: number) => string;
  layers: (done: number, total: number) => string;
  pause: string;
  resume: string;
  finish: string;
  started: string;
  built: (seconds: string) => string;
  finished: string;
}
