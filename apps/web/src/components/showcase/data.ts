/* Mock data for the components showcase. OpenVitals-themed. */

export type IntegrationStatus = "connected" | "syncing" | "issue" | "paused";

export interface Integration {
  id: string;
  name: string;
  vendor: string;
  status: IntegrationStatus;
  lastSync: string;
  records: number;
  delta: number;
}

export const integrations: Integration[] = [
  {
    id: "epic-1",
    name: "Epic — North Region",
    vendor: "Epic Systems",
    status: "connected",
    lastSync: "2 min ago",
    records: 184_239,
    delta: 4.2
  },
  {
    id: "cerner-1",
    name: "Oracle Health (Cerner)",
    vendor: "Oracle",
    status: "syncing",
    lastSync: "now",
    records: 92_174,
    delta: 1.8
  },
  {
    id: "athena-1",
    name: "Athenahealth",
    vendor: "athenahealth",
    status: "connected",
    lastSync: "6 min ago",
    records: 41_802,
    delta: 0.3
  },
  {
    id: "abridge-1",
    name: "Abridge — Ambient scribe",
    vendor: "Abridge",
    status: "issue",
    lastSync: "1 hr ago",
    records: 6_124,
    delta: -2.1
  },
  {
    id: "fitbit-1",
    name: "Fitbit (Google)",
    vendor: "Google Health",
    status: "connected",
    lastSync: "12 min ago",
    records: 28_410,
    delta: 12.5
  },
  {
    id: "apple-1",
    name: "Apple Health Records",
    vendor: "Apple",
    status: "paused",
    lastSync: "3 days ago",
    records: 14_006,
    delta: 0
  }
];

export interface VitalEntry {
  id: string;
  patient: string;
  patientCode: string;
  metric: "BP" | "HR" | "SpO₂" | "Temp" | "Glucose";
  value: string;
  reference: string;
  flag: "normal" | "watch" | "critical";
  timestamp: string;
  source: string;
  trend: { v: number }[];
}

export const vitals: VitalEntry[] = [
  {
    id: "v-1",
    patient: "Avery Marsh",
    patientCode: "PT-04812",
    metric: "BP",
    value: "128/82",
    reference: "120/80 mmHg",
    flag: "watch",
    timestamp: "08:14",
    source: "Epic",
    trend: [{ v: 118 }, { v: 122 }, { v: 119 }, { v: 124 }, { v: 126 }, { v: 128 }, { v: 128 }]
  },
  {
    id: "v-2",
    patient: "Jonas Liu",
    patientCode: "PT-04790",
    metric: "HR",
    value: "62",
    reference: "60–100 bpm",
    flag: "normal",
    timestamp: "07:58",
    source: "Apple Health",
    trend: [{ v: 78 }, { v: 74 }, { v: 70 }, { v: 68 }, { v: 65 }, { v: 64 }, { v: 62 }]
  },
  {
    id: "v-3",
    patient: "Renata Holm",
    patientCode: "PT-04760",
    metric: "SpO₂",
    value: "92",
    reference: "≥ 95 %",
    flag: "critical",
    timestamp: "08:02",
    source: "Withings",
    trend: [{ v: 97 }, { v: 96 }, { v: 95 }, { v: 94 }, { v: 93 }, { v: 92 }, { v: 92 }]
  },
  {
    id: "v-4",
    patient: "Mira Okonkwo",
    patientCode: "PT-04733",
    metric: "Temp",
    value: "37.1",
    reference: "36.1–37.5 °C",
    flag: "normal",
    timestamp: "07:41",
    source: "Cerner",
    trend: [{ v: 36.8 }, { v: 36.9 }, { v: 37.0 }, { v: 37.1 }, { v: 37.0 }, { v: 37.1 }, { v: 37.1 }]
  },
  {
    id: "v-5",
    patient: "Caleb Northrop",
    patientCode: "PT-04702",
    metric: "Glucose",
    value: "164",
    reference: "70–140 mg/dL",
    flag: "watch",
    timestamp: "08:20",
    source: "Dexcom",
    trend: [{ v: 110 }, { v: 134 }, { v: 152 }, { v: 168 }, { v: 158 }, { v: 162 }, { v: 164 }]
  },
  {
    id: "v-6",
    patient: "Arjun Patel",
    patientCode: "PT-04688",
    metric: "BP",
    value: "118/76",
    reference: "120/80 mmHg",
    flag: "normal",
    timestamp: "08:30",
    source: "Epic",
    trend: [{ v: 124 }, { v: 122 }, { v: 120 }, { v: 119 }, { v: 118 }, { v: 117 }, { v: 118 }]
  }
];

export const heartRateSeries = Array.from({ length: 28 }, (_, i) => {
  const base = 72 + Math.sin(i / 3) * 6 + (i / 28) * 2;
  const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.9)) * 1.6;
  return {
    x: `${(8 + Math.floor(i / 2)).toString().padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
    bpm: Math.round((base + noise) * 10) / 10
  };
});

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
] as const;

export const cohortSeries: Array<{
  x: string;
  Connected: number;
  Pending: number;
  Failed: number;
}> = Array.from({ length: 12 }, (_, i) => ({
  x: months[i] ?? "—",
  Connected: 12 + i * 2 + Math.round(Math.sin(i) * 3),
  Pending: 4 + Math.round(Math.cos(i / 2) * 2),
  Failed: i > 6 ? 1 : 2 + Math.round(Math.sin(i / 3) * 1)
}));

export const benchmarkSeries = [
  { x: "Cardio", baseline: 64, observed: 78 },
  { x: "Endo", baseline: 71, observed: 82 },
  { x: "Neuro", baseline: 58, observed: 66 },
  { x: "Onco", baseline: 81, observed: 74 },
  { x: "Pulm", baseline: 69, observed: 88 },
  { x: "Renal", baseline: 55, observed: 71 }
];

export const sourceMix = [
  { name: "EHR — Epic", value: 184239 },
  { name: "Cerner", value: 92174 },
  { name: "Wearables", value: 42416 },
  { name: "Athenahealth", value: 41802 },
  { name: "Other", value: 12480 }
];

export interface ChangelogItem {
  id: string;
  version: string;
  date: string;
  title: string;
  summary: string;
  tags: ("API" | "schema" | "ingestion" | "review" | "audit" | "ui")[];
}

export const changelog: ChangelogItem[] = [
  {
    id: "v124",
    version: "v1.24.0",
    date: "Apr 28, 2026",
    title: "Provenance graph in record detail",
    summary:
      "Every clinical fact now traces back to a source document, an extraction span, and a reviewer signature.",
    tags: ["audit", "review", "ui"]
  },
  {
    id: "v123",
    version: "v1.23.4",
    date: "Apr 21, 2026",
    title: "Outbox: at-least-once → exactly-once",
    summary:
      "Outbox dispatcher now uses transactional staging plus idempotency keys end-to-end.",
    tags: ["ingestion", "API"]
  },
  {
    id: "v123-3",
    version: "v1.23.3",
    date: "Apr 14, 2026",
    title: "FHIR R5 preflight validator",
    summary:
      "Inbound bundles are validated and quarantined before they reach the canonical store.",
    tags: ["schema", "ingestion"]
  }
];

export const teamMembers = [
  { id: "u1", name: "Eli Williams", role: "Lead Engineer", initials: "EW", color: "#E5352B" },
  { id: "u2", name: "Maya Chen", role: "Clinical Informatics", initials: "MC", color: "#3F4E8A" },
  { id: "u3", name: "Diego Sosa", role: "Platform Eng", initials: "DS", color: "#1F7A5C" },
  { id: "u4", name: "Priya Rao", role: "Data Eng", initials: "PR", color: "#A85F1F" },
  { id: "u5", name: "Sam Atkins", role: "Compliance", initials: "SA", color: "#5E3F8A" },
  { id: "u6", name: "Nadia Park", role: "Design", initials: "NP", color: "#2E6F8E" }
];

export const sourceOptions = [
  { value: "epic", label: "Epic", description: "EHR — North Region" },
  { value: "cerner", label: "Oracle Health", description: "Cerner — South" },
  { value: "athena", label: "Athenahealth", description: "Outpatient" },
  { value: "abridge", label: "Abridge", description: "Ambient scribe" },
  { value: "fitbit", label: "Fitbit", description: "Wearable — daily" },
  { value: "apple", label: "Apple Health", description: "Patient sync" },
  { value: "dexcom", label: "Dexcom", description: "Continuous glucose" },
  { value: "withings", label: "Withings", description: "Home BP" }
];
