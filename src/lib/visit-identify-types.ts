export type IdentifyPosition = {
  id: string;
  company: string;
  title: string;
};

export type IdentifyPromptPayload = {
  show: boolean;
  visitId: string | null;
  suggested: IdentifyPosition | null;
  positions: IdentifyPosition[];
};
