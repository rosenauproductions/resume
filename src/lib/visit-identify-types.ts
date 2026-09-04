export type IdentifyPosition = {
  id: string;
  company: string;
  title: string;
};

export type IdentifyKnownIdentity = {
  applicationId: string | null;
  company: string;
  title: string;
  freeText: string;
  contactName: string;
  /** Short display line for the welcome card */
  label: string;
};

export type IdentifyPromptPayload = {
  show: boolean;
  /** First-time identify vs returning welcome (already identified). */
  mode: "identify" | "welcome";
  visitId: string | null;
  suggested: IdentifyPosition | null;
  known: IdentifyKnownIdentity | null;
  positions: IdentifyPosition[];
};
