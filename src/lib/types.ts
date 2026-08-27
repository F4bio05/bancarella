export type Person = {
  id: number;
  name: string;
  phone: string | null;
  note: string | null;
  archived: boolean;
};

export type Movement = {
  id: number;
  personId: number;
  amountCents: number;
  note: string | null;
  clientId: string | null;
  createdAt: string;
};

export type Participant = {
  personId: number;
  name: string;
  addedAt: string;
  totalCents: number;
  items: number;
};

export type DaySummary = {
  id: number;
  date: string;
  label: string | null;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  totalCents: number;
  peopleCount: number;
  itemsCount: number;
};

export type DayState = {
  day: DaySummary;
  participants: Participant[];
  movements: Movement[];
};
