// src/lib/trainingAcademy.ts
// Static curriculum for the Murivest Junior Capital Advisor Academy.
// Content lives here (not in the DB) so you can edit lessons, paste video URLs,
// and add PDF/document downloads directly in code.
// Drop media files in:
//   public/training/videos/    -> Zoom recordings, lesson videos
//   public/training/documents/ -> PDFs, DOCX, sheets, checklists

export type ResourceType = "video" | "pdf" | "doc" | "sheet" | "link" | "folder";

export interface AcademyResource {
  id: string;
  type: ResourceType;
  title: string;
  url: string; // local path under /public, or a full https:// URL (Drive/YouTube)
  description?: string;
}

export interface AcademyLesson {
  id: string;
  title: string;
  duration: string; // e.g. "12 min"
  videoUrl?: string; // optional per-lesson video
  content: string;
  resources?: AcademyResource[];
}

export interface AcademyModule {
  code: string; // stable key, e.g. "M4" — used for progress + localStorage
  moduleNumber: number; // matches training_modules.module_number in Supabase (for DB progress)
  title: string;
  subtitle: string;
  description: string;
  duration: string;
  mandatory: boolean;
  passMark: number;
  maxAttempts: number;
  zoomRecordingUrl?: string; // your recorded Zoom session for this module
  zoomScript: string; // condensed facilitator script (full script lives in the PDF)
  slideDeckPrompt: string; // paste into Claude to generate the presentation
  lessons: AcademyLesson[];
  resources: AcademyResource[]; // module-level downloads
}

/* ------------------------------------------------------------------ */
/* Shared documents (referenced across modules)                        */
/* ------------------------------------------------------------------ */

const DOC = (file: string) => `/training/documents/${file}`;
const VID = (file: string) => `/training/videos/${file}`;

const DOCS = {
  nda: { id: "nda", type: "pdf" as const, title: "Associate NDA", url: DOC("01_Associate_NDA.pdf"), description: "Sign and return before system access." },
  commissionCard: { id: "commission-card", type: "pdf" as const, title: "Commission Structure Reference Card", url: DOC("02_Commission_Structure.pdf"), description: "3% standard, 60/40 co-broke splits, worked examples." },
  kpiScorecard: { id: "kpi-scorecard", type: "pdf" as const, title: "KPI Scorecard (Traffic Light)", url: DOC("03_KPI_Scorecard.pdf"), description: "Weekly self-assessment — Green / Amber / Red." },
  dailyWorkflow: { id: "daily-workflow", type: "pdf" as const, title: "Daily Workflow Chart", url: DOC("04_Daily_Workflow_Chart.pdf"), description: "7:30 AM to 6:00 PM operating rhythm." },
  assetClassGuide: { id: "asset-class-guide", type: "pdf" as const, title: "Asset Class Reference Guide", url: DOC("05_Asset_Class_Reference.pdf"), description: "Asset types, NOI factors, value drivers." },
  yieldWorksheet: { id: "yield-worksheet", type: "pdf" as const, title: "Yield & Cap Rate Worksheet", url: DOC("06_Yield_CapRate_Worksheet.pdf"), description: "Training exercise with model answers." },
  onboardingChecklist: { id: "onboarding-checklist", type: "pdf" as const, title: "Property Onboarding Checklist", url: DOC("07_Property_Onboarding_Checklist.pdf"), description: "Complete before any property goes live." },
  listingTemplate: { id: "listing-template", type: "pdf" as const, title: "Listing Description Template", url: DOC("08_Listing_Description_Template.pdf"), description: "7-section institutional listing structure." },
  outreachTemplates: { id: "outreach-templates", type: "pdf" as const, title: "Outreach Message Templates", url: DOC("09_Outreach_Message_Templates.pdf"), description: "WhatsApp, LinkedIn, cold email scripts." },
  sellerCallScript: { id: "seller-call-script", type: "pdf" as const, title: "Seller Cold Call Script Card", url: DOC("10_Seller_Cold_Call_Script.pdf"), description: "Quick reference during live calls." },
  investorQualification: { id: "investor-qualification", type: "pdf" as const, title: "Investor Qualification Framework", url: DOC("11_Investor_Qualification_Framework.pdf"), description: "The 5 qualification questions + scoring." },
  emailPack: { id: "email-pack", type: "pdf" as const, title: "Email Templates Pack (6)", url: DOC("12_Email_Templates_Pack.pdf"), description: "Ready-to-use investor emails." },
  masterFolderMap: { id: "master-folder-map", type: "pdf" as const, title: "Murivest Master Folder — Navigation Map", url: DOC("13_Master_Folder_Map.pdf"), description: "Every folder, what lives in it, who owns it." },
  weeklyReport: { id: "weekly-report", type: "pdf" as const, title: "Weekly Report Template", url: DOC("14_Weekly_Report_Template.pdf"), description: "Submit every Friday by 5 PM." },
  buyerScorecard: { id: "buyer-scorecard", type: "pdf" as const, title: "Buyer Qualification Scorecard", url: DOC("15_Buyer_Qualification_Scorecard.pdf"), description: "Use on every buyer call." },
  objectionCard: { id: "objection-card", type: "pdf" as const, title: "Objection Handling Quick Reference", url: DOC("16_Objection_Handling_Card.pdf"), description: "Pocket reference — price, DD, KYC, commission." },
  institutionalChecklist: { id: "institutional-checklist", type: "pdf" as const, title: "Institutional Documentation Checklist", url: DOC("17_Institutional_Documentation_Checklist.pdf"), description: "Full document stack for family office / fund deals." },
  linkedinCalendar: { id: "linkedin-calendar", type: "pdf" as const, title: "LinkedIn Content Calendar Template", url: DOC("18_LinkedIn_Content_Calendar.pdf"), description: "Plan weekly content in advance." },
  conductStandards: { id: "conduct-standards", type: "pdf" as const, title: "Professional Conduct Standards", url: DOC("19_Professional_Conduct_Standards.pdf"), description: "Sign and retain. EARB + Data Protection Act 2019." },
  articlePrompt: { id: "article-prompt", type: "doc" as const, title: "Master AI Article Prompt", url: DOC("20_Master_AI_Article_Prompt.docx"), description: "The exact prompt used to generate publishable articles." },
  publishingSOP: { id: "publishing-sop", type: "pdf" as const, title: "Multi-Platform Publishing SOP", url: DOC("21_Multi_Platform_Publishing_SOP.pdf"), description: "Step-by-step posting sequence for all 9 channels." },
  propertySOP: { id: "property-sop", type: "pdf" as const, title: "Property Publishing SOP (Internal System)", url: DOC("22_Property_Publishing_SOP.pdf"), description: "How to publish and edit assigned properties." },
};

/* ------------------------------------------------------------------ */
/* The 12 modules                                                      */
/* ------------------------------------------------------------------ */

export const MODULES: AcademyModule[] = [
  {
    code: "M1",
    moduleNumber: 1,
    title: "Murivest Orientation & Institutional Positioning",
    subtitle: "What Murivest is, what we stand for, what your role means",
    description:
      "Murivest is a commercial real estate advisory and investment platform headquartered in Nairobi. We do not operate as a traditional estate agency — we operate as an institutional-grade advisory firm serving HNWIs, family offices, and international investors deploying capital into Kenyan and East African real estate. This module sets the standard everything else is measured against.",
    duration: "60 min",
    mandatory: true,
    passMark: 80,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M1_Orientation_Zoom.mp4"),
    zoomScript: `Welcome. My name is Mark Muriithi, Founder and Principal of Murivest Realty Group. Today marks the beginning of your journey with us.

Murivest is a commercial real estate advisory and investment platform headquartered in Nairobi, Kenya. We are not a traditional estate agency. We operate as an institutional-grade advisory firm — which means we work with high-net-worth individuals, family offices, and international investors deploying significant capital into Kenyan and East African real estate.

Everything we produce — brochures, underwriting memos, investor communications — is designed to meet the standard a London or Dubai investment office would expect. That is not accidental. That is the standard we hold ourselves to every single day.

Why does this matter to you? Because the way you present yourself, the way you communicate with sellers, the way you publish content — it all reflects on this brand. You are not just closing transactions. You are building a reputation.

Three things from day one. First — confidentiality. Every deal, every investor name, every internal document is confidential. You sign an NDA before accessing our systems. Second — discipline. Our business runs on systems. If it is not in the system, it did not happen. Third — professionalism. Every email, WhatsApp message, and published article must reflect the calibre of this organisation.

As a Junior Capital Advisor, your primary responsibilities are: publishing AI-assisted articles across our digital channels with your attribution, and publishing and editing properties on the internal system as assigned. Everything in this academy supports those two core mandates.

Welcome to Murivest. Let us get to work.`,
    slideDeckPrompt: `Create a 12-slide presentation for Murivest Realty Group's internal training: "Module 1 — Murivest Orientation & Institutional Positioning" for Junior Capital Advisors.

Brand style: forest green #1B4332 backgrounds, brass #B8956B accent lines, cream #F8F7F4 text, serif headlines (Playfair Display), editorial Harvard Business Review layout, golf-club institutional elegance. Minimal, no clip art.

Slides: (1) Title — Murivest Orientation & Institutional Positioning, (2) What Murivest is — CRE advisory platform, Nairobi HQ, (3) What we are NOT — traditional estate agency comparison table, (4) Institutional-grade standard — what a London/Dubai investment office expects, (5) Your role as Junior Capital Advisor — the two core mandates: AI article publishing + property publishing, (6) The Murivest identity — "We don't sell real estate. We allocate access.", (7) The three day-one commitments: Confidentiality, Discipline, Professionalism, (8) The group structure — Realty, Group, Foundation, Trust, (9) Career path — Junior Capital Advisor to Deal Manager, (10) The 12-module academy roadmap, (11) KPI standards overview, (12) Homework: review murivest.com, sign the NDA, write 3 sentences on what Murivest does.

Include speaker notes under each slide written in Mark Muriithi's voice — direct, authoritative, warm.`,
    lessons: [
      {
        id: "1-1",
        title: "1.1 — Welcome to Murivest",
        duration: "15 min",
        videoUrl: VID("M1_L1_Welcome.mp4"),
        content: `Murivest operates at the intersection of ownership and institutional capital. Unlike traditional brokerages that list publicly, we work off-market — where relationships, discretion, and timing define outcomes.

Memorise this before every conversation: "We don't sell real estate. We allocate access to off-market, income-producing commercial assets to investors who understand value before it reaches the open market."

You are NOT a broker — you are a capital allocation advisor. You are NOT listing properties — you are curating opportunities. Every article you publish and every property you upload must carry this positioning.

Over this academy you will learn every system and standard we operate at: how to publish institutional content, how to publish properties on the internal system, how to source and qualify, and how deals move from origination to closing.`,
        resources: [DOCS.nda],
      },
      {
        id: "1-2",
        title: "1.2 — Business Model & Commission Structure",
        duration: "25 min",
        videoUrl: VID("M1_L2_Business_Model.mp4"),
        content: `Murivest earns advisory and brokerage fees on commercial real estate transactions. Standard fee: 3% of transaction value on the buy side, 3% on the sell side where we represent the seller. In co-brokerage, we negotiate a split — typically 60/40 in our favour where we originated the deal.

Example: a KES 450M office building closing at 3% generates KES 13.5M gross commission. With a 60/40 co-broke, Murivest receives KES 8.1M.

Why deal size matters: a residential agent closes 20 transactions to earn what a commercial advisor earns in two or three deals. We focus exclusively on commercial — offices, mixed-use, hospitality, land, industrial.

How YOUR commission is traced: every article you publish and every property you publish carries your name, your direct contact (phone/WhatsApp/email), and your advisor code. When an investor enquires through your content, the lead is tagged to you in the system — permanently. Sourcing credit and buyer credit follow you. Protect your attribution like you protect your income, because it IS your income.

Your commission structure is set out in your associate agreement: sourcing credit for properties you bring, publishing credit for content that generates qualified inbound leads, and buyer credit for investors you qualify who close.`,
        resources: [DOCS.commissionCard],
      },
      {
        id: "1-3",
        title: "1.3 — Expectations & Career Path",
        duration: "20 min",
        videoUrl: VID("M1_L3_Expectations.mp4"),
        content: `This is not a passive role. The advisors who succeed treat it like a business — because it is.

Weekly minimum activity: 20+ property sourcing conversations, 50+ investor outreach messages, 30+ CRM follow-ups, 20+ LinkedIn actions, daily content publishing or property tasks as assigned, 3–5 meetings booked, daily activity log submitted every working day, weekly report every Friday by 5 PM.

Primary mandates for a Junior Capital Advisor: (1) publish AI-assisted articles to the Murivest website, Medium, Blogger, LinkedIn articles, Instagram, Google Posts, Quora, and Reddit — always with your contact attribution; (2) publish and edit properties assigned to you on the internal system to institutional standard.

Career path: Junior Capital Advisor → Senior Associate → Deal Manager → team lead under the Murivest brand. The advisors who build this platform from the ground up will be positioned best as it scales across East Africa.`,
        resources: [DOCS.kpiScorecard, DOCS.dailyWorkflow],
      },
    ],
    resources: [DOCS.nda, DOCS.commissionCard, DOCS.kpiScorecard, DOCS.dailyWorkflow],
  },

  {
    code: "M2",
    moduleNumber: 2,
    title: "Real Estate Fundamentals",
    subtitle: "Asset classes, yield, cap rates and NOI",
    description:
      "Before you can publish a property or advise an investor, you must know what type of asset you are dealing with and what drives its value. Every serious investor asks two questions immediately: what is the yield, and what is the cap rate?",
    duration: "55 min",
    mandatory: true,
    passMark: 80,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M2_Fundamentals_Zoom.mp4"),
    zoomScript: `Commercial real estate is a broad category. Before you can source, qualify, publish, or advise on a property, you need to know what type of asset you are dealing with and what drives its value.

Offices: purpose-built space valued on net leasable area, lease terms, and occupancy. Grade A offices in Westlands or Upper Hill command premium rents. NOI factor 0.70.

Mixed-use: retail plus office plus sometimes residential. Common in the CBD, diverse tenant profiles, high commission potential. NOI factor 0.70.

Retail: valued on tenant quality and foot traffic. NOI factor 0.75. Industrial and warehousing: booming on regional trade growth — most efficient asset at 0.85 NOI factor. Hospitality: complex underwriting involving RevPAR and occupancy — NOI factor 0.65, highest operational burden. Land: purest play, NOI factor 1.0 — pure capital value, no income.

Now the numbers every investor asks for. Yield = Annual Rental Income ÷ Purchase Price × 100. A building generating KES 45M rent on a KES 450M price yields 10%. Cap rate = Net Operating Income ÷ Property Value. NOI is gross rent minus operating expenses, before debt service. With a 0.70 NOI factor, KES 45M gross becomes KES 31.5M NOI — a 7% cap rate at KES 450M.

When you publish any property listing, these numbers must be present and correct: gross rent, NOI, cap rate, yield. You should run this calculation mentally within 60 seconds for any asset. Your published content must never contain a yield you cannot defend.`,
    slideDeckPrompt: `Create a 10-slide presentation for Murivest internal training: "Module 2 — Real Estate Fundamentals: Commercial Property Types, Yield, Cap Rates & NOI".

Brand style: forest green #1B4332, brass #B8956B accents, cream #F8F7F4 text, Playfair Display headlines, editorial HBR layout, institutional elegance.

Slides: (1) Title, (2) Why fundamentals matter before you publish anything, (3) Asset classes overview — Office, (4) Mixed-use & Retail, (5) Industrial, Hospitality, Land, (6) NOI factor table by asset class, (7) Yield formula with worked example (KES 45M / KES 450M = 10%), (8) Cap rate formula with worked example (0.70 NOI factor → 7% cap), (9) The publishing rule — every listing must show gross rent, NOI, cap rate, yield, (10) Homework exercise — BASL House calculation.

Speaker notes under each slide, Mark Muriithi's voice, direct and precise.`,
    lessons: [
      {
        id: "2-1",
        title: "2.1 — Commercial Property Types & Asset Classes",
        duration: "30 min",
        videoUrl: VID("M2_L1_Asset_Classes.mp4"),
        content: `Offices: valued on net leasable area, lease terms, occupancy. Grade A in Westlands or Upper Hill command premium rents. Murivest examples: Rahimtulla Trust, Absa Towers, Uchumi House.

Mixed-use: retail + office + sometimes residential. Common in Nairobi's CBD, diverse tenants, high commission potential. Examples: Absa Towers, BASL House.

Retail: shopping centres, strips, standalone shops — valued on tenant quality and foot traffic. Industrial & warehousing: logistics, manufacturing, cold storage — booming on East African regional trade, NOI factor 0.85, most efficient.

Hospitality: hotels, serviced apartments, lodges — complex underwriting with RevPAR and occupancy, NOI factor 0.65. Land: raw or titled land for development — NOI factor 1.0, pure capital value, extremely important in Nairobi and coastal markets; handled through our dedicated land desk.

Student housing and seniors housing: emerging classes with growing family office interest.

The first question any investor asks is: what is the yield? Your published listings must answer it in the first two paragraphs.`,
        resources: [DOCS.assetClassGuide],
      },
      {
        id: "2-2",
        title: "2.2 — Yield, Cap Rates & Investment Analysis",
        duration: "25 min",
        videoUrl: VID("M2_L2_Yield_CapRate.mp4"),
        content: `Yield = Annual Rental Income ÷ Purchase Price × 100. KES 45M rent on KES 450M price = 10% yield.

Cap rate = NOI ÷ Property Value. NOI = gross rent minus operating expenses, before debt service.

NOI factors (memorise): Office 0.70 · Retail 0.75 · Industrial 0.85 · Residential 0.70 · Mixed-use 0.70 · Hospitality 0.65 · Land 1.00.

Worked example: office building, KES 45M gross rent, 0.70 factor → KES 31.5M NOI → at KES 450M value, cap rate = 7%.

When you publish a property on the internal system, the Financial Summary section must always state: asking price, annual gross rental income, gross yield, and estimated cap rate. Never publish a number you cannot defend on a call — investors will test you, and credibility lost in print is lost permanently.`,
        resources: [DOCS.yieldWorksheet],
      },
    ],
    resources: [DOCS.assetClassGuide, DOCS.yieldWorksheet],
  },

  {
    code: "M3",
    moduleNumber: 3,
    title: "Property Publishing on the Internal System",
    subtitle: "Onboarding checklist, uploads, institutional listing descriptions & SEO",
    description:
      "Every property that enters our pipeline gets published on the internal system and the Murivest website. Nothing goes live without the complete onboarding checklist, and every listing reads like an investment memorandum — not a classified ad.",
    duration: "50 min",
    mandatory: true,
    passMark: 80,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M3_Property_Publishing_Zoom.mp4"),
    zoomScript: `Every property that enters our pipeline must be published in two places: the internal system, and the Murivest website. Today I will show you exactly how to do both, and the standard every listing is held to.

Before you touch the upload system, you must have collected everything on the Property Onboarding Checklist: property name and PRT-XXX ID, full address and GPS coordinates, title deed and land reference numbers, registered owner matching the title, asking price in KES, annual rental income if tenanted, floor area, floors, year built, building grade, a minimum of 5 high-resolution exterior photos, floor plan if available, seller motivation, and exclusivity status. Nothing gets uploaded without a complete checklist.

In the internal system you open the property workspace, complete every field, upload media, and set status. Simultaneously you publish to the website with the same PRT-XXX reference so internal records and public listings always match.

The SEO title is critical. Do not write "Uchumi House". Write "Uchumi House — Grade A Mixed-Use Building for Sale in Nairobi CBD, KES 450M". That is how we capture organic investor search traffic.

The description follows the 7-section template: SEO headline, investment overview, property specifications, location and accessibility, financial summary, acquisition rationale, call to action with your name and direct contact. Your attribution goes on every listing you publish — that is how your commission is traced. Let us walk through a live upload now.`,
    slideDeckPrompt: `Create a 10-slide presentation for Murivest internal training: "Module 3 — Property Publishing on the Internal System".

Brand style: forest green #1B4332, brass #B8956B, cream #F8F7F4, Playfair Display, HBR editorial layout.

Slides: (1) Title, (2) The golden rule — nothing uploads without a complete checklist, (3) Onboarding checklist Part 1 — identity & legal fields, (4) Onboarding checklist Part 2 — location, technical, media, (5) Internal system walkthrough — property workspace fields, (6) Website upload — Sanity/CMS fields, PRT-XXX matching, (7) SEO titles that capture investor search, (8) The 7-section listing description template, (9) Your attribution — name, contact, advisor code on every listing, (10) Homework — practice upload exercise.

Speaker notes in Mark Muriithi's voice.`,
    lessons: [
      {
        id: "3-1",
        title: "3.1 — Onboarding Checklist & Uploads",
        duration: "30 min",
        videoUrl: VID("M3_L1_Onboarding_Uploads.mp4"),
        content: `Required before any upload: property name · PRT-XXX ID (generated in the system) · full address + GPS coordinates · title deed number · land reference number · registered owner (must match title) · ownership structure · asking price (KES) · annual rental income if tenanted · total floor area · number of floors · year built/renovated · building grade (A+/A/A-/B+/B/B-/C) · minimum 5 high-res exterior photos · floor plan if available · seller motivation · exclusivity status.

In the internal system: open the property workspace → complete every field → upload media → set status → assign yourself as publishing advisor. Simultaneously publish to the Murivest website using the same PRT-XXX reference.

Deal context must be completed within 48 hours of first seller contact: motivation (liquidity/divestment/loan due/relocation), exclusivity (exclusive/co-exclusive/open), any agent involved with EARB number, seller timeline, previous marketing history.

Do not enter a property into the website or internal system until ALL identity, legal, location, financial, technical and media items are complete.`,
        resources: [DOCS.onboardingChecklist, DOCS.propertySOP],
      },
      {
        id: "3-2",
        title: "3.2 — Institutional Listing Descriptions & SEO",
        duration: "20 min",
        videoUrl: VID("M3_L2_Listings_SEO.mp4"),
        content: `Most listings in Kenya read "Nice property, good location, call for info." That is not how we operate. Our listings read like investment memoranda — clear, data-driven, institutional.

The 7-section template: (1) SEO headline — Asset Type + Grade + Location + Use Case + Price, e.g. "Grade A Mixed-Use Commercial Building — Nairobi CBD — KES 450M — Institutional Investment Opportunity". (2) Investment overview — 2-3 sentences leading with the financial case. (3) Property specifications. (4) Location & accessibility. (5) Financial summary — asking price, gross income, gross yield, estimated cap rate. (6) Acquisition rationale — why an institutional buyer or family office would acquire it. (7) Call to action — standard closing with your name, direct phone, WhatsApp and email.

SEO: target phrases like "commercial property for sale Nairobi", "office building for sale Westlands", "KES 500M real estate investment Kenya" — used naturally in the title and first paragraph.

Every listing ends with YOUR contact block. When an investor enquires, the system tags that lead to you. Your published portfolio is a lead engine that pays you for years.`,
        resources: [DOCS.listingTemplate],
      },
    ],
    resources: [DOCS.onboardingChecklist, DOCS.listingTemplate, DOCS.propertySOP],
  },

  {
    code: "M4",
    moduleNumber: 4,
    title: "AI Content Publishing & Multi-Platform Distribution",
    subtitle: "Your core mandate — publish AI-assisted articles everywhere, with your attribution",
    description:
      "This is your primary revenue-generating mandate as a Junior Capital Advisor. You will use a master AI prompt to produce institutional-grade articles, then publish them across nine channels: Murivest Website, Medium, Blogger, LinkedIn Articles, Instagram, Google Posts, Quora, and Reddit. Every post carries your contact details so every enquiry is traced to you and your commission.",
    duration: "75 min",
    mandatory: true,
    passMark: 85,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M4_Content_Publishing_Zoom.mp4"),
    zoomScript: `This module is your core mandate as a Junior Capital Advisor, so pay close attention.

Here is how the machine works. Marketing and strategy produce a content calendar of article topics — market analysis, asset class explainers, deal commentary, Nairobi yield reports. You take the assigned topic, run the master AI prompt with your specific angle, review the output against the Murivest editorial standard, and then publish it across nine channels: the Murivest website blog, Medium, Blogger, LinkedIn articles, Instagram captions and carousels, Google Business Posts, Quora answers, and Reddit threads.

One article, nine touchpoints, one hour of focused work if you are disciplined.

Now the most important part — attribution. Every single post, on every platform, ends with your contact block: your name, "Junior Capital Advisor, Murivest Realty Group", your direct phone, your WhatsApp, your email. Most platforms allow a link — where they do, link to your Murivest advisor profile page. When an investor reads your Nairobi office yield analysis on Medium and messages you on WhatsApp, that lead is tagged to your advisor code in the system. It is your lead. If it converts to a deal, the sourcing and buyer credit follows you. This is how a Junior Capital Advisor builds a KES 10M+ annual income from content.

The editorial standard: HBR tone — context before content, data before adjectives, no exclamation marks, no hype, no "amazing opportunity". Forest green and brass brand presentation on visual platforms. If AI produces anything that would embarrass us in front of a family office CIO, you rewrite it before it ships. You are the publisher. The AI is your research assistant — you are the brand.

Weekly minimum: two full articles published across all nine channels, plus daily Google Posts or Instagram content. Screenshot everything and attach to your Friday report. Let me show you the master prompt and the publishing sequence.`,
    slideDeckPrompt: `Create a 14-slide presentation for Murivest internal training: "Module 4 — AI Content Publishing & Multi-Platform Distribution (The Junior Capital Advisor Content Engine)".

Brand style: forest green #1B4332, brass #B8956B, cream #F8F7F4, Playfair Display headlines, HBR editorial layout.

Slides: (1) Title, (2) Why content is your primary mandate — inbound lead engine, (3) How the machine works — topic → AI prompt → your review → 9 platforms, (4) The master AI prompt — structure and variables, (5) Editorial standard — HBR tone, prohibited terms, (6) Platform 1-2: Murivest website blog + SEO checklist, (7) Platform 3-4: Medium & Blogger setup and formatting, (8) Platform 5: LinkedIn articles + personal profile optimisation, (9) Platform 6-7: Instagram captions/carousels + Google Business Posts, (10) Platform 8-9: Quora answers & Reddit threads — etiquette, no spam, (11) YOUR ATTRIBUTION — the contact block that traces commission to you, (12) Lead capture — how enquiries flow into the system tagged to your advisor code, (13) Weekly KPIs — 2 articles, daily posts, screenshots to Friday report, (14) Homework — first article assignment.

Speaker notes in Mark Muriithi's voice, precise and demanding on quality.`,
    lessons: [
      {
        id: "4-1",
        title: "4.1 — The Master AI Prompt & Editorial Standard",
        duration: "20 min",
        videoUrl: VID("M4_L1_AI_Prompt.mp4"),
        content: `The master prompt (assigned topic → AI → your review). Use it exactly, replacing the bracketed variables:

"You are a senior institutional real estate analyst writing for Murivest Realty Group, a Nairobi-based commercial real estate advisory firm serving UHNWI, family offices and international investors. Write a [1,200–1,500 word] article on [ASSIGNED TOPIC]. Tone: Harvard Business Review editorial — analytical, measured, data-led. No exclamation marks, no hype, no emojis. Structure: (1) a hook opening with a specific data point, (2) market context with numbers, (3) 3 core insights with subheadings, (4) what this means for investors, (5) a closing call to action to contact the author. Include a suggested headline, meta description, and 5 SEO keywords. Kenyan commercial real estate context. Mention yields, cap rates, and specific submarkets (Westlands, Upper Hill, CBD, Gigiri) where relevant. End with an author block."

Editorial standard — non-negotiable: context before content, data before adjectives, one primary message per article, no attachments, full credentials in the sign-off. Prohibited: "amazing", "unbelievable", "cheap", "commission", "just checking in". You are the publisher. Anything the AI produces that you would not say to a family office CIO, you rewrite before it ships.`,
        resources: [DOCS.articlePrompt],
      },
      {
        id: "4-2",
        title: "4.2 — Publishing Sequence: Website, Medium, Blogger, LinkedIn",
        duration: "20 min",
        videoUrl: VID("M4_L2_Web_Medium_LinkedIn.mp4"),
        content: `Sequence per article (45–60 minutes total):

1. MURIVEST WEBSITE BLOG — paste into the CMS, add the SEO title, meta description, keywords, category, and a featured image from the media library. Set yourself as the author.

2. MEDIUM — create/claim your Medium profile under your name with "Junior Capital Advisor at Murivest Realty Group" in the bio. Import or paste the article, add 3–5 relevant tags (Commercial Real Estate, Kenya, Investing, Nairobi, Real Estate). Medium's canonical import points back to our site — good for SEO.

3. BLOGGER — same article on your Murivest-branded Blogger site. Keep formatting clean, add labels, link back to the full Murivest listing or website.

4. LINKEDIN ARTICLES — publish as a LinkedIn article on your personal profile (not just a post — an article). First 2 lines must hook before the "see more" fold. Tag the Murivest company page.

Every version ends with your contact block: full name · Junior Capital Advisor, Murivest Realty Group · direct phone · WhatsApp · email · link to your advisor profile. No exceptions.`,
        resources: [DOCS.publishingSOP],
      },
      {
        id: "4-3",
        title: "4.3 — Instagram, Google Posts, Quora & Reddit",
        duration: "20 min",
        videoUrl: VID("M4_L3_Instagram_Quora_Reddit.mp4"),
        content: `5. INSTAGRAM — convert the article into a caption (first line is the hook) plus a carousel of 5–7 slides summarising the key data points, or a single branded graphic. Use the brand kit: forest green #1B4332, brass #B8956B, cream background, serif headlines. Always put your contact in the caption and "Link in bio" to your advisor page.

6. GOOGLE BUSINESS POSTS — publish a 2–3 sentence summary with the hero image on the Murivest Google Business Profile. These surface in search and Maps — high-intent local visibility.

7. QUORA — find questions matching your article ("Is Nairobi commercial real estate a good investment?"). Write a genuine 200–300 word answer with one insight from the article, then link to the full piece. Answer 2–3 questions per article. Never paste the whole article — Quora penalises it.

8. REDDIT — r/Kenya, r/realestateinvesting, r/Africa. Become a genuine contributor first. Share insights, disclose your affiliation, follow each subreddit's self-promotion rules. One thoughtful post per article, maximum.

These four channels are discovery engines. Investors who find you here arrive pre-qualified by your thinking.`,
        resources: [DOCS.publishingSOP],
      },
      {
        id: "4-4",
        title: "4.4 — Attribution, Lead Capture & Commission Tracing",
        duration: "15 min",
        videoUrl: VID("M4_L4_Commission_Tracing.mp4"),
        content: `This is how content pays you.

Every post carries your contact block. When an investor reaches out, log the enquiry in the system with source = the platform and your advisor code. The lead is now permanently tagged to you.

Commission flow: your article → investor enquiry (tagged to you) → you qualify and nurture → investor closes on any Murivest property → sourcing/buyer credit follows your advisor code → your success fee is calculated on your contribution, per your associate agreement.

Content compounds. An article you publish in Month 1 can generate a closing in Month 9. Publishing credit is tracked in your weekly report: article title, platforms published, reach/screenshots, enquiries generated. Top content advisors are promoted fastest because they build the firm's inbound pipeline and their own book simultaneously.

Never remove attribution. Never publish on a personal account without your Murivest title and contact block. The brand lends you authority — the attribution pays you for it.`,
        resources: [DOCS.publishingSOP, DOCS.kpiScorecard],
      },
    ],
    resources: [DOCS.articlePrompt, DOCS.publishingSOP],
  },

  {
    code: "M5",
    moduleNumber: 5,
    title: "Lead Generation Systems",
    subtitle: "Sourcing off-market properties and building the HNW & international buyer pipeline",
    description:
      "The most valuable skill in commercial real estate is finding properties before they are publicly listed. Off-market deals give us exclusivity, protect our fees, and give our investors access nobody else has. On the other side, every deal needs a buyer — ideally found before the deal.",
    duration: "60 min",
    mandatory: true,
    passMark: 80,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M5_Lead_Generation_Zoom.mp4"),
    zoomScript: `The most valuable skill in commercial real estate is finding properties before they are publicly listed. Off-market deals give us exclusivity — which protects our fee — and give our investors access nobody else has.

Three sourcing channels. First, direct landowner outreach: we identify target buildings and approach owners or property managers directly. The cold call opener is: "Good morning, my name is [Name] from Murivest Realty Group. We are an institutional real estate advisory firm working with high-net-worth buyers and family offices looking to acquire commercial assets in Nairobi. I am reaching out because [Building Name] matches the profile of what our clients are currently seeking. Has there been any consideration of a sale in the near to medium term?" You are not asking if it is for sale — you are asking if they have considered it. A much softer opener that gets honest answers.

Second, the broker network: every EARB-registered agent in Nairobi is a potential source. When a broker brings you a deal, assess it against the Property Onboarding Checklist, and if it qualifies, initiate a co-brokerage conversation immediately.

Third, market scanning: Jiji and BuyRentKenya daily, Knight Frank and Pam Golding portals, LinkedIn searches for developers and fund managers, and physical canvassing of Upper Hill, Westlands, Gigiri and Karen.

On the buyer side, memorise the seven investor profiles — local HNWI, Kenyan family office, diaspora, international, developer, REIT/fund — and the five qualification questions: target investment size, income vs growth, capital or debt, prior Kenyan CRE experience, and decision authority. Every investor you speak to gets entered in the system with full profile, budget, preference, and KYC status — whether they buy or not.`,
    slideDeckPrompt: `Create a 12-slide presentation for Murivest internal training: "Module 5 — Lead Generation Systems: Off-Market Sourcing & the Investor Pipeline".

Brand style: forest green #1B4332, brass #B8956B, cream #F8F7F4, Playfair Display, HBR editorial.

Slides: (1) Title, (2) Why off-market is the moat — exclusivity protects fees, (3) Channel 1 — direct owner outreach + the exact cold call script, (4) "Considered a sale?" vs "is it for sale" — psychology, (5) Channel 2 — broker network & co-brokerage protocol, (6) Channel 3 — market scanning: Jiji, portals, LinkedIn, canvassing, (7) Sellers tracker fields — motivation, exclusivity, next follow-up, (8) The 7 investor profiles table, (9) The 5 qualification questions, (10) Buyers CRM — why the database is a company asset, (11) KPIs — 20+ sourcing calls, 3 properties/week, (12) Homework.

Speaker notes in Mark Muriithi's voice.`,
    lessons: [
      {
        id: "5-1",
        title: "5.1 — Property Sourcing: Finding Off-Market Sellers",
        duration: "30 min",
        videoUrl: VID("M5_L1_OffMarket_Sourcing.mp4"),
        content: `Cold owner call: "Good morning, my name is [Name] from Murivest Realty Group. We are an institutional real estate advisory firm working with high-net-worth buyers and family offices seeking commercial assets in Nairobi. I am reaching out because [Building Name] in [Location] matches the profile of what our clients are currently seeking. Has there been any consideration of a sale in the near to medium term?"

You are not asking if it is for sale. You are asking if they have considered it. Softer opener, more honest answers.

Broker network: every EARB-registered agent is a potential source. Assess broker deals against the Onboarding Checklist; if qualified, initiate co-brokerage immediately and log in the sellers tracker.

Market scanning: Jiji ("commercial property for sale Nairobi") daily · BuyRentKenya new listings · Knight Frank / Pam Golding portals · LinkedIn ("commercial real estate Kenya") · physical canvassing of Upper Hill, Westlands, Gigiri, Karen noting For Sale / To Let boards.

Every seller contact logged: name, phone + email, property name/address/asset type, motivation (liquidity/divestment/loan due/relocation), asking price or POA, exclusivity status, next follow-up date.`,
        resources: [DOCS.sellerCallScript, DOCS.onboardingChecklist],
      },
      {
        id: "5-2",
        title: "5.2 — Investor Sourcing: The HNW & International Buyer Pipeline",
        duration: "30 min",
        videoUrl: VID("M5_L2_Investor_Sourcing.mp4"),
        content: `Seven investor profiles: Local HNWI (KES 100M+, referrals/WhatsApp/events — want yield, preservation) · Kenyan family office (direct intro, LinkedIn — income, diversification) · Diaspora (UK/UAE/US Kenyans — LinkedIn, WhatsApp groups — home-country exposure, passive income) · International (UK/UAE/Singapore family offices and PE — LinkedIn, API Global — emerging market yield) · Developer (broker network, LinkedIn — margin, land) · REIT/Fund (direct outreach — portfolio-grade, ESG).

The five qualification questions for every first conversation: What is your target investment size? Income now or medium-term capital growth? Capital available or debt financing? Prior Kenyan CRE experience? Are you the final decision-maker?

Every investor — buyer or not — gets a full entry in the system: profile, budget, asset preference, financing status, KYC status, relationship strength (Hot/Warm/Cold). This database becomes one of Murivest's most valuable assets, and every name you add compounds your own book.`,
        resources: [DOCS.investorQualification, DOCS.outreachTemplates],
      },
    ],
    resources: [DOCS.sellerCallScript, DOCS.investorQualification],
  },

  {
    code: "M6",
    moduleNumber: 6,
    title: "Cold Email & Investor Outreach",
    subtitle: "Email fundamentals, investor psychology, and the 4-touch cadence",
    description:
      "Cold email is the highest-leverage outreach tool for international investors. A well-written email reaches a London family office principal at 9 AM their time and generates a response within hours. A poorly written one gets deleted in three seconds.",
    duration: "25 min",
    mandatory: true,
    passMark: 80,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M6_Cold_Email_Zoom.mp4"),
    zoomScript: `Cold email is our highest-leverage tool for international investors. Let me show you how we write emails that get answered.

Four elements. Element one — the subject line: specific, data-driven. "Grade A Office Building — Nairobi CBD — 10% Yield — KES 450M" beats "Investment Opportunity in Kenya" every single time. Element two — the opening line: reference a specific, relevant hook. Their industry, a recent event, a mutual connection. Never "I hope this email finds you well." Element three — the offer in two to three sentences: what you have, the key financials, why it is relevant to them specifically. Element four — one clear, low-commitment ask: "Would you like me to send you the executive summary?" Not "would you like to buy this?"

Sample: "Dear [Name], I am reaching out from Murivest Realty Group, a commercial real estate advisory firm in Nairobi. I am currently advising on the off-market sale of a Grade A mixed-use commercial building in Nairobi's CBD, offered at KES 450 million — approximately USD 3.5 million — with a current gross yield of 10% against a blue-chip tenancy profile. Given your focus on sub-Saharan Africa, I thought this might be of interest. I am happy to send an executive summary and underwriting memo for your initial review — no commitment required. Would that be useful?"

Follow-up cadence: Day 1 email, Day 4 email follow-up, Day 9 LinkedIn message on a different channel, Day 14 final email — "I am closing my file on this; happy to keep you posted on future deals." After four touches, mark "No Response" and keep them in the system for future briefs. Every touch is logged with the follow-up count.`,
    slideDeckPrompt: `Create a 9-slide presentation for Murivest internal training: "Module 6 — Cold Email & Investor Outreach".

Brand style: forest green #1B4332, brass #B8956B, cream #F8F7F4, Playfair Display, HBR editorial.

Slides: (1) Title, (2) Why cold email is the highest-leverage international channel, (3) Element 1 — subject lines that get opened (with examples), (4) Element 2 — opening lines (and banned openings), (5) Element 3 — the 2-3 sentence offer, (6) Element 4 — the one low-commitment ask, (7) Full sample email annotated, (8) The 4-touch cadence table (Day 1/4/9/14), (9) Homework — write a cold email for Rahimtulla Trust targeting a UK family office.

Speaker notes in Mark Muriithi's voice.`,
    lessons: [
      {
        id: "6-1",
        title: "6.1 — Email Fundamentals & Investor Psychology",
        duration: "25 min",
        videoUrl: VID("M6_L1_Email_Psychology.mp4"),
        content: `The four elements: (1) Subject — specific and data-driven: "Grade A Office Building — Nairobi CBD — 10% Yield — KES 450M". (2) Opening — a specific hook; never "I hope this email finds you well". (3) The offer — 2-3 sentences with key financials and why it is relevant to THEM. (4) The ask — one clear, low-commitment step: "Would that be useful?"

Full sample: "Dear [Name], I am reaching out from Murivest Realty Group, a commercial real estate advisory firm in Nairobi. I am advising on the off-market sale of a Grade A mixed-use building in Nairobi's CBD, offered at KES 450 million (approx. USD 3.5M) with a current gross yield of 10% against a blue-chip tenancy profile. Given your focus on sub-Saharan Africa, I thought this might be of interest. I can send an executive summary and underwriting memo for your initial review — no commitment required. Would that be useful? Best regards, [Name], Associate Investment Advisor | Murivest Realty Group".

Cadence: Day 1 cold email · Day 4 follow-up · Day 9 LinkedIn (different channel) · Day 14 final — "closing my file on this". After 4 touches: mark "No Response", keep in system. Log everything with follow-up counts.`,
        resources: [DOCS.emailPack],
      },
    ],
    resources: [DOCS.emailPack, DOCS.outreachTemplates],
  },

  {
    code: "M7",
    moduleNumber: 7,
    title: "The Murivest Master Folder & Deal File System",
    subtitle: "Your operating system — the full company file architecture, replacing the Control Tower",
    description:
      "The Murivest Master Folder is the central nervous system of the operation — every deal, mandate, property file, client record, and report lives here. Junior Capital Advisors navigate it daily instead of the legacy Control Tower spreadsheet.",
    duration: "65 min",
    mandatory: true,
    passMark: 80,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M7_Master_Folder_Zoom.mp4"),
    zoomScript: `This is the most important systems session in your training. The Murivest Master Folder is the central nervous system of our operation. Everything — every deal, every mandate, every property file, every client record — lives in this architecture. If you learn to navigate it, you will always know exactly where everything stands.

Let me walk the structure. 00_GROUP_STRUCTURE holds the corporate entities — Murivest Realty registration, board resolutions, the Murivest Group, Foundation and Trust documents. 01_EXECUTIVE_COMMAND holds vision, board materials, the CEO office, strategic decisions, expansion plans, investor relations, and the KPI dashboard. 02_STRATEGY_AND_GROWTH holds business strategy, market expansion, partnerships, revenue and capital raising plans.

03_DEALS_AND_TRANSACTIONS is your home territory. It holds the pipeline register, the master mandates index, active negotiations — each with its own folder — closed deals, lost deals, business cases, and the LOI master register with drafts, submissions, and signed files. Every mandate folder follows the same 11-section skeleton: 01 Executive Summary, 02 Mandate and Authority, 03 Property Information, 04 Financials, 05 Marketing and Materials, 06 Photos and Media, 07 Due Diligence, 08 Buyer Engagement, 09 Offers and Negotiation, 10 Transaction Execution, 11 Post-Closing. When you publish a property or an article, the supporting files belong in these sections.

04_CLIENTS_AND_CRM holds buyers, sellers and vendors, investors, tenants, and the leads database. 05_PARTNERS_AND_INTERMEDIARIES holds company partners — API Global, Knight Frank, Pam Golding, Kuria Holdings — brokers, lawyers, valuers, banks. 06 covers property management and AUM. 07 legal and compliance, including the Authority to Sell master index. 08 finance and accounting. 09 operations — daily execution, SOPs, sales management, lead management, and your weekly reports. 10 research and intelligence — the Nairobi Yield Report and market research live here, and this is where you source the data points for your articles. 11 brand and marketing — brand assets, property marketing, the content library. 12 services and products. 13 talent and leadership. 14 systems and technology. 15 the e-learning library. 16 key document templates. 99 the archive.

The golden rule: if a file exists anywhere in this structure, it must exist in the right section of the right folder. When you complete a task — publish an article, publish a property — you file the evidence in the correct location the same day. Discipline in filing is discipline in dealmaking.`,
    slideDeckPrompt: `Create a 14-slide presentation for Murivest internal training: "Module 7 — The Murivest Master Folder & Deal File System".

Brand style: forest green #1B4332, brass #B8956B, cream #F8F7F4, Playfair Display, HBR editorial.

Slides: (1) Title, (2) The Master Folder is the operating system — Control Tower retired, (3) Top-level architecture map (00–16 + 99 archive), (4) 00 Group structure & 01 Executive command, (5) 02 Strategy, (6) 03 Deals & transactions — pipeline register & mandates index, (7) The 11-section mandate folder skeleton (01 Executive Summary → 11 Post-Closing), (8) 04 Clients & CRM + 05 Partners, (9) 06 Property management, 07 Legal & compliance — ATS index, (10) 08 Finance, 09 Operations — where YOUR weekly reports live, (11) 10 Research — your article data source, 11 Brand & content library, (12) 15 E-learning & 16 Templates, (13) Filing rules — same-day evidence, naming conventions, (14) Homework — navigation exercise.

Speaker notes in Mark Muriithi's voice.`,
    lessons: [
      {
        id: "7-1",
        title: "7.1 — Master Folder Architecture: The Full Walkthrough",
        duration: "45 min",
        videoUrl: VID("M7_L1_Architecture.mp4"),
        content: `The 17-zone architecture:

00_GROUP_STRUCTURE — corporate entities, registrations, board resolutions.
01_EXECUTIVE_COMMAND — vision, board materials, CEO office, strategic decisions, expansion, investor relations, KPI dashboard.
02_STRATEGY_AND_GROWTH — business strategy, market expansion, partnerships, revenue and capital-raising plans.
03_DEALS_AND_TRANSACTIONS — pipeline register, master mandates index, active negotiations (each deal its own folder), closed/lost deals, business cases, LOI master register. The 11-section mandate skeleton: 01 Executive Summary · 02 Mandate and Authority · 03 Property Information · 04 Financials · 05 Marketing and Materials · 06 Photos and Media · 07 Due Diligence · 08 Buyer Engagement · 09 Offers and Negotiation · 10 Transaction Execution · 11 Post-Closing.
04_CLIENTS_AND_CRM — buyers (profile, KYC, requirements, financial capacity, LOIs, communication), sellers/vendors, investors, tenants, leads database.
05_PARTNERS_AND_INTERMEDIARIES — company partners, brokers, lawyers, valuers, banks, marketing partners, international partners.
06_PROPERTY_MANAGEMENT_AND_AUM — managed properties, leases, tenants, rent collections, maintenance, inspections, AUM reporting, insurance.
07_LEGAL_AND_COMPLIANCE — contracts, NDAs, Authority to Sell master index, commission agreements, LOI legal templates, purchase agreements, compliance filings, LSK regulations.
08_FINANCE_AND_ACCOUNTING — company financials, P&L, cashflow, budgets, commissions, invoices, tax, payroll, investor distributions, financial models.
09_OPERATIONS — daily execution, SOPs, sales management, lead management, HR, weekly/monthly/quarterly reports (yours live here), risk register.
10_RESEARCH_AND_INTELLIGENCE — CRE reports, market research, competitor and investor intelligence. Your article data points come from here.
11_BRAND_AND_MARKETING — brand assets, property marketing, social media, paid ads, the content library, PR, website materials.
12_SERVICES_AND_PRODUCTS — proposals, service offerings, engagement letters, invoices, advisory products.
13_TALENT_AND_LEADERSHIP — training, hiring, onboarding, performance, culture.
14_SYSTEMS_AND_TECHNOLOGY — Murivest OS documentation, Supabase, automations, CRM, website, backups, IT security.
15_MURIVEST_ELEARNING — the full course library.
16_KEY_DOCUMENTS_AND_TEMPLATES — official templates for every document type.
99_ARCHIVE — superseded and deprecated files, never deleted.`,
        resources: [DOCS.masterFolderMap],
      },
      {
        id: "7-2",
        title: "7.2 — Daily Log & Weekly Reporting Inside the Master Folder",
        duration: "20 min",
        videoUrl: VID("M7_L2_Reporting.mp4"),
        content: `Accountability lives in 09_OPERATIONS. Every working day you file your activity evidence; every Friday by 5 PM you submit the structured weekly report to the Principal via email or WhatsApp.

Weekly report format: 1. Pipeline summary (deals advanced, sourced, lost) · 2. Buyer activity · 3. Seller activity · 4. Outreach numbers (calls/emails/LinkedIn/WhatsApp totals) · 5. KPI status (Green/Amber/Red each) · 6. Blockers · 7. Next week's top 3 priorities. Plus your publishing annex: articles published (title + 9 platform links), properties published/edited (PRT IDs), and screenshots of reach and enquiries.

File evidence the same day: published article links go to 11_BRAND_AND_MARKETING content library; property files to the correct mandate folder sections; enquiry logs to the leads database. If it is not filed, it did not happen — and if it did not happen, it does not earn.`,
        resources: [DOCS.weeklyReport, DOCS.kpiScorecard],
      },
    ],
    resources: [DOCS.masterFolderMap, DOCS.weeklyReport],
  },

  {
    code: "M8",
    moduleNumber: 8,
    title: "Commercial Real Estate Sales",
    subtitle: "Buyer qualification, deal structuring, negotiation, objections & closing",
    description:
      "The fastest way to waste time in commercial real estate is spending it on unqualified buyers. Before you invest time in an underwriting memo, a site visit, or an LOI, you must know your buyer is serious, has capacity, and is genuinely interested.",
    duration: "60 min",
    mandatory: true,
    passMark: 80,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M8_CRE_Sales_Zoom.mp4"),
    zoomScript: `The fastest way to waste time in this business is spending it on unqualified buyers. Before you invest time in a memo, a site visit, or an LOI, you must know the buyer is serious, has capacity, and is genuinely interested.

The six qualification areas: financial capacity — what is the budget, capital or financing, red flag is vague answers; decision authority — are they the decision-maker, red flag is multiple unnamed decision-makers; asset preference — class, location, grade, income or growth, red flag is wanting "anything"; timeline — target completion date, red flag is no urgency; KYC readiness — resistance to identity verification; previous experience — first-time buyers with unrealistic expectations.

Six areas passed: Priority 1, relationship strength "Hot". Three to four: "Warm". Under three: "Cold" — keep in the system, do not prioritise.

On deal structuring: when a qualified buyer confirms interest, the next step is an LOI — a non-binding document stating intent, proposed price, key conditions, and an exclusivity period for due diligence. LOIs run 14 to 21 days; expired LOIs are marked and moved on from.

On negotiation: it is not aggression — it is understanding what both parties truly want. "The price is too high" means they want to buy but need internal justification — answer with comparable transactions and offer alternative structures. The most important rule: let the other party talk more than you. Never concede without getting something in return. The 3-step close: confirm commitment — "are you in a position to move forward, what would need to be in place to sign an LOI this week"; remove blockers; create momentum — "the seller has asked for all LOIs by [date], can I submit yours?" Deals close when there is a deadline.`,
    slideDeckPrompt: `Create a 12-slide presentation for Murivest internal training: "Module 8 — Commercial Real Estate Sales: Qualification, Negotiation & Closing".

Brand style: forest green #1B4332, brass #B8956B, cream #F8F7F4, Playfair Display, HBR editorial.

Slides: (1) Title, (2) Why unqualified buyers kill pipelines, (3) The 6 qualification areas + red flags table, (4) Hot/Warm/Cold scoring, (5) The LOI — purpose, key terms, 14-21 day expiry, (6) Negotiation philosophy — interests over positions, (7) Objection: "price is too high" + response, (8) Objection: "need more time for DD" + response, (9) Objection: "looking at another property" + response, (10) The golden rule — let them talk; concessions are trades, (11) The 3-step close with scripts, (12) Homework — scorecard exercise.

Speaker notes in Mark Muriithi's voice.`,
    lessons: [
      {
        id: "8-1",
        title: "8.1 — Buyer Qualification & Deal Structuring",
        duration: "30 min",
        videoUrl: VID("M8_L1_Qualification.mp4"),
        content: `Six qualification areas: Financial capacity (budget? capital or debt? red flag: "we'll figure out finance later") · Decision authority (board/partners? red flag: unnamed decision-makers, no timeline) · Asset preference (class/location/grade, income or growth — red flag: "anything") · Timeline (target completion — red flag: no urgency) · KYC readiness (red flag: resistance to verification) · Previous experience (red flag: first-timer, unrealistic expectations).

Scoring: 6/6 = Priority 1 ("Hot") · 3–4 = "Warm" · under 3 = "Cold" (keep, don't prioritise).

LOI: non-binding statement of intent — proposed price, key conditions, exclusivity period for due diligence. 14–21 day expiry. Tracked in the LOI register within the deal folder; expired LOIs are marked and the pipeline moves on.`,
        resources: [DOCS.buyerScorecard],
      },
      {
        id: "8-2",
        title: "8.2 — Negotiation, Objections & Closing",
        duration: "30 min",
        videoUrl: VID("M8_L2_Negotiation_Closing.mp4"),
        content: `"The price is too high" → they want to buy but need internal justification: "Understood. Let me share the comparable transactions in this submarket that support the pricing — and if there is a structure that works better, I am happy to present it to the seller."

"We need more time for due diligence" → "Of course. What specific areas are you focused on? I can facilitate access to the relevant documentation directly."

"We are looking at another property" → "Completely reasonable. I would note this asset has had two expressions of interest this month — may I at least get an executive summary in front of your team this week?"

The golden rule: let the other party talk more than you. Ask, understand, then present solutions. Never concede without getting something in return.

3-step close: (1) Confirm commitment — "Based on everything we have discussed, are you in a position to move forward? What would need to be in place to sign an LOI this week?" (2) Remove blockers. (3) Create momentum — "The seller has asked for all LOIs by [date]. Can I submit yours?"`,
        resources: [DOCS.objectionCard],
      },
    ],
    resources: [DOCS.buyerScorecard, DOCS.objectionCard],
  },

  {
    code: "M9",
    moduleNumber: 9,
    title: "Institutional Real Estate Advisory",
    subtitle: "Family offices, funds & cross-border investors",
    description:
      "The investors who transact at the largest scale — family offices, private equity funds, sovereign wealth vehicles — operate differently from a private buyer. They want institutional-grade documentation, formal processes, and a clear investment thesis.",
    duration: "30 min",
    mandatory: true,
    passMark: 80,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M9_Institutional_Zoom.mp4"),
    zoomScript: `The largest transactions in commercial real estate come from family offices, private equity funds, and sovereign wealth vehicles. They operate differently from private buyers — and you must adapt.

Family offices manage multi-generational wealth through a CIO or investment committee. Decisions take months. They want institutional-grade documentation: underwriting memos, market research, legal opinions, title confirmation. They do not decide based on a WhatsApp message and a floor plan. You send a formal investment brief — not a casual email. You request a formal meeting — not a call. And you arrive prepared with an underwriting memo, a market context note, and a clear investment thesis.

The institutional documentation stack: the one-page executive summary goes out at first contact; the 8–15 page investment memorandum after interest is confirmed; the market research report with submarket data alongside it; the due diligence checklist at LOI stage; the NDA before sensitive financials; the LOI when the buyer is ready; the sale agreement at legal stage. Every template exists in the document library — you take the template, input deal data, and the Principal reviews before anything goes to an institutional investor.

For international investors — UK, UAE, Singapore — the process is identical, plus you must be prepared on currency risk, KES versus USD or GBP, repatriation mechanics, and foreign investment regulations. We can address all of these questions; we simply need to be prepared for them.`,
    slideDeckPrompt: `Create a 9-slide presentation for Murivest internal training: "Module 9 — Institutional Real Estate Advisory: Family Offices, Funds & Cross-Border Investors".

Brand style: forest green #1B4332, brass #B8956B, cream #F8F7F4, Playfair Display, HBR editorial.

Slides: (1) Title, (2) Who the institutional capital is, (3) How family offices actually decide — committees, months not weeks, (4) The formality gap — briefs not chats, meetings not calls, (5) The documentation stack — 7 documents with timing, (6) Templates exist — your job is deal data + Principal review, (7) Cross-border specifics — currency, repatriation, foreign regulation, (8) Stewardship language — multi-generational framing, (9) Homework — underwriting memo section review.

Speaker notes in Mark Muriithi's voice.`,
    lessons: [
      {
        id: "9-1",
        title: "9.1 — Working with Family Offices, Funds & Cross-Border Investors",
        duration: "30 min",
        videoUrl: VID("M9_L1_Family_Offices.mp4"),
        content: `Family offices: multi-generational wealth, CIO or investment committee, decisions in months. Formal briefs not casual emails; formal meetings not calls. Arrive with an underwriting memo, market context note, and a clear thesis.

Documentation stack and timing: Executive Summary (1 page) — first contact · Investment Memorandum (8–15 pages) — after interest confirmed · Market Research Report — with the memo · Due Diligence Checklist — at LOI stage · NDA — before sensitive financials · LOI/Offer Letter — when buyer is ready · Sale Agreement — legal stage. All templates live in the Master Folder (16_KEY_DOCUMENTS_AND_TEMPLATES) and each deal's 02_Mandate_and_Authority section. You never create from scratch — template plus deal data, Principal review before sending.

Cross-border (UK/UAE/Singapore): same process, plus currency risk (KES vs USD/GBP), repatriation mechanics, and foreign investment regulations. Be prepared for these questions before they are asked.`,
        resources: [DOCS.institutionalChecklist],
      },
    ],
    resources: [DOCS.institutionalChecklist],
  },

  {
    code: "M10",
    moduleNumber: 10,
    title: "Digital Marketing & SEO",
    subtitle: "Content strategy & the investor-facing digital presence",
    description:
      "Our digital presence is a lead generation engine. The website, LinkedIn, and editorial content work together to bring investors to us — so not every lead requires cold outreach. Your published articles are the fuel.",
    duration: "25 min",
    mandatory: true,
    passMark: 80,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M10_Digital_Marketing_Zoom.mp4"),
    zoomScript: `Our digital presence is a lead generation engine. The website, our LinkedIn presence, and our editorial content work together to bring investors to us.

We publish SEO-optimised articles targeting searches like "commercial real estate Kenya", "invest in Nairobi office buildings", "Kenya family office real estate". Each article is structured to rank on Google and direct the reader toward a contact point — which, for your articles, is your attribution block. When an investor you have never met reads your analysis and messages you, the cold-outreach problem disappears. That is the machine Module 4 operationalises.

Your LinkedIn personal profile is part of the strategy. Post at least twice a week: market insights with one or two data points, deal teasers that generate inbound enquiries, short explainers on cap rates or NOI that position you as an advisor rather than a salesperson, and shares of Murivest articles with personal commentary. Optimise your headline — "Junior Capital Advisor at Murivest Realty Group | Off-Market Commercial Real Estate, Nairobi" — not just a job title.

Track performance in your weekly publishing annex: article reach, profile views, enquiries generated per platform. Over 90 days you will see which of your nine channels produces the most qualified investors, and you will double down there. Content is not vanity — it is a measured lead channel with your name on it.`,
    slideDeckPrompt: `Create a 9-slide presentation for Murivest internal training: "Module 10 — Digital Marketing & SEO: Content Strategy & Investor-Facing Presence".

Brand style: forest green #1B4332, brass #B8956B, cream #F8F7F4, Playfair Display, HBR editorial.

Slides: (1) Title, (2) Digital presence as lead engine, (3) SEO targets & article structure that ranks, (4) The reader journey — article → your attribution → enquiry, (5) LinkedIn profile optimisation checklist, (6) The 4 content formats with frequencies, (7) Measuring performance — reach, views, enquiries per platform, (8) 90-day channel doubling-down strategy, (9) Homework.

Speaker notes in Mark Muriithi's voice.`,
    lessons: [
      {
        id: "10-1",
        title: "10.1 — Content Strategy & Investor-Facing Digital Presence",
        duration: "25 min",
        videoUrl: VID("M10_L1_Content_Strategy.mp4"),
        content: `SEO articles target searches like "commercial real estate Kenya", "invest in Nairobi office buildings", "Kenya family office real estate" — structured to rank and route readers to a contact point: your attribution block.

LinkedIn formula (2+ posts/week): Market insight — a data point + 1-2 supporting points + call to connect · Deal tease — "advising on an off-market commercial asset in Nairobi CBD — DM for details" · Market education — cap rates, NOI, deal stages, positioning as advisor · Company content — share Murivest articles with personal commentary.

Profile optimisation: headline = "Junior Capital Advisor at Murivest Realty Group | Off-Market Commercial Real Estate, Nairobi" · banner on brand · featured section with your three best articles · contact info visible.

Measure everything in your weekly annex: article reach, profile views, enquiries per platform. After 90 days, double down on the channels that produce qualified investors.`,
        resources: [DOCS.linkedinCalendar],
      },
    ],
    resources: [DOCS.linkedinCalendar],
  },

  {
    code: "M11",
    moduleNumber: 11,
    title: "Reporting & Accountability",
    subtitle: "Daily reporting, KPI scorecards & performance standards",
    description:
      "Commercial real estate deals have long timelines — 3, 6, sometimes 12 months from first contact to closing. Without consistent tracking, deals evaporate, follow-ups are missed, buyers go cold. Our reporting structure exists to prevent that.",
    duration: "20 min",
    mandatory: true,
    passMark: 80,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M11_Reporting_Zoom.mp4"),
    zoomScript: `Let me be direct about something. In a traditional agency you might go weeks without reporting activity. That is not how we operate.

Our reporting structure has three layers. Daily: file your activity evidence in the Master Folder before you end the working day — three minutes, non-negotiable. Weekly: the structured written report to the Principal every Friday by 5 PM, including your publishing annex with article links, platform screenshots, and enquiry logs. Monthly: a 30-minute pipeline review call where you present every deal, every buyer, every KPI for the month — I respond, we decide priorities together.

The KPI scorecard uses the traffic light system. Green: 20+ sourcing calls, 50+ investor outreach, 30+ CRM follow-ups, 3+ meetings, 5/5 daily logs, on-time weekly report, plus your publishing KPIs — two articles across nine channels weekly, daily Google Posts or Instagram content. Amber is below target. Red is under half. If you are consistently red on any KPI, we have a structured conversation about what is in the way — this is operational discipline that protects your income as much as the firm's pipeline.

The standards that cannot be compromised: no freestyle selling, no low-status language, no chasing without qualifying, every conversation ends with a specific next step, every site visit pre-confirmed, never present before pain is uncovered — and never publish below the editorial standard.`,
    slideDeckPrompt: `Create a 10-slide presentation for Murivest internal training: "Module 11 — Reporting & Accountability".

Brand style: forest green #1B4332, brass #B8956B, cream #F8F7F4, Playfair Display, HBR editorial.

Slides: (1) Title, (2) Why reporting exists — long deal cycles kill untracked pipelines, (3) The three layers — daily / Friday 5 PM / monthly review call, (4) Daily evidence filing in the Master Folder, (5) Weekly report structure — 7 sections + publishing annex, (6) KPI traffic-light table with targets, (7) Publishing KPIs — 2 articles/week across 9 channels, (8) Red-zone protocol — structured conversation, not punishment, (9) The non-negotiable standards list, (10) Homework — first weekly report.

Speaker notes in Mark Muriithi's voice.`,
    lessons: [
      {
        id: "11-1",
        title: "11.1 — Daily Reporting, KPIs & Performance Standards",
        duration: "20 min",
        videoUrl: VID("M11_L1_KPIs.mp4"),
        content: `Three reporting layers: DAILY — file activity evidence in the Master Folder before end of day, 3 minutes, non-negotiable. WEEKLY — structured report to the Principal, Friday 5 PM: pipeline summary, buyer activity, seller activity, outreach numbers, KPI status, blockers, next week's top 3 — plus your publishing annex (article links, screenshots, enquiries). MONTHLY — 30-minute pipeline review call: every deal, every buyer, every KPI; you present, the Principal responds.

Traffic lights: GREEN — 20+ sourcing calls, 50+ investor outreach, 30+ CRM follow-ups, 3+ meetings, 5/5 daily logs, on-time report, 2 articles/week + daily posts. AMBER — below target. RED — under half. Consistent red = structured performance conversation.

Publishing KPIs sit alongside sales KPIs: two full articles across all nine channels weekly, daily Google Posts or Instagram content, screenshots attached to the Friday report.

Non-negotiables: every conversation ends with a specific next step; never publish below the editorial standard; if it is not filed, it did not happen.`,
        resources: [DOCS.kpiScorecard, DOCS.weeklyReport],
      },
    ],
    resources: [DOCS.kpiScorecard, DOCS.weeklyReport],
  },

  {
    code: "M12",
    moduleNumber: 12,
    title: "Legal, Compliance & Ethics",
    subtitle: "Confidentiality, NDAs & professional conduct",
    description:
      "Before you access any deal information, investor data, or internal systems, you sign an NDA. This is not a formality — it is a legal instrument that protects our clients, our deals, and our business. EARB governs licensed agents in Kenya, and the Data Protection Act 2019 governs every piece of client data you touch.",
    duration: "20 min",
    mandatory: true,
    passMark: 90,
    maxAttempts: 3,
    zoomRecordingUrl: VID("M12_Legal_Zoom.mp4"),
    zoomScript: `Before you access any Murivest deal information, investor data, or internal systems, you sign an NDA. This is a legal instrument that protects our clients, our deals, and our business.

Confidentiality means: you do not share deal details with anyone outside the transaction without explicit permission. You do not discuss investor names, deal values, or property situations with family, friends, or other agents. You do not post about active deals on social media without authorisation — and remember, your published articles must never reveal an off-market property's identity, exact pricing of an active mandate, or a client's name without written clearance. General market commentary is fine; deal specifics are not.

Non-circumvention means: you do not go around Murivest to transact a deal you discovered through our platform. If you source a buyer or seller through Murivest systems and attempt to transact directly, that is a breach of your associate agreement and legal action follows. This includes leads generated through your published articles — they belong to the Murivest system with your credit attached, not to a private side deal.

Professional conduct standards: all written communication professional at all times — this now includes your public articles and platform posts; you do not make representations about a property's legal status, title, or regulatory compliance — you direct buyers to their own legal advisors; no undisclosed side payments — all commission arrangements go through Murivest; no false urgency — if a deal has competitive interest you may say so, only if true; client data handled under Kenya's Data Protection Act 2019.

EARB — the Estate Agents Registration Board — governs licensed agents in Kenya. Violations of professional conduct can end your career in formal real estate. If you are ever unsure what is ethically correct: do not do anything you would not be comfortable explaining to me or to a client. And when in doubt — ask.`,
    slideDeckPrompt: `Create a 10-slide presentation for Murivest internal training: "Module 12 — Legal, Compliance & Ethics: Confidentiality, NDAs & Professional Conduct".

Brand style: forest green #1B4332, brass #B8956B, cream #F8F7F4, Playfair Display, HBR editorial, serious tone.

Slides: (1) Title, (2) The NDA is a legal instrument — not a formality, (3) Confidentiality in practice — what you never share, (4) Publishing confidentiality — what articles may NEVER reveal (off-market identities, active mandates, client names), (5) Non-circumvention — including article-generated leads, (6) Professional conduct standards — the 6 rules, (7) Data Protection Act 2019 — handling client data, (8) EARB — the regulatory framework and career consequences, (9) The decision rule — "would you explain it to a client?", (10) Homework — EARB code review, NDA signature confirmation.

Speaker notes in Mark Muriithi's voice — firm, unambiguous.`,
    lessons: [
      {
        id: "12-1",
        title: "12.1 — Confidentiality, NDAs & Professional Conduct",
        duration: "20 min",
        videoUrl: VID("M12_L1_Compliance.mp4"),
        content: `Confidentiality: never share deal details, investor names, deal values, or property situations outside the transaction — including with family and other agents. Never post about active deals without authorisation.

PUBLISHING CONFIDENTIALITY (critical for your mandate): articles may discuss markets, yields, and trends, but must never name an off-market property, reveal an active mandate's exact terms, or identify a client without written clearance from the Principal.

Non-circumvention: leads from your published articles are Murivest leads with your credit attached. Transacting around the firm — including private side deals with article-generated enquiries — is a breach of your associate agreement.

Conduct standards: all communication professional (including public posts) · no representations on title/legal status — direct buyers to their legal advisors · no undisclosed side payments · no false urgency · client data under the Data Protection Act 2019.

EARB governs licensed agents in Kenya — violations can end your career. When in doubt, ask.`,
        resources: [DOCS.nda, DOCS.conductStandards],
      },
    ],
    resources: [DOCS.nda, DOCS.conductStandards],
  },
];

export const getModule = (code: string) =>
  MODULES.find((m) => m.code === code.toUpperCase());

export const moduleNumberToCode = (n: number) =>
  MODULES.find((m) => m.moduleNumber === n)?.code;

/* The master AI article prompt — also surfaced in Module 4 lessons */
export const MASTER_ARTICLE_PROMPT = `You are a senior institutional real estate analyst writing for Murivest Realty Group, a Nairobi-based commercial real estate advisory firm serving UHNWI, family offices and international investors. Write a [1,200–1,500 word] article on [ASSIGNED TOPIC]. Tone: Harvard Business Review editorial — analytical, measured, data-led. No exclamation marks, no hype, no emojis. Structure: (1) a hook opening with a specific data point, (2) market context with numbers, (3) 3 core insights with subheadings, (4) what this means for investors, (5) a closing call to action to contact the author. Include a suggested headline, meta description, and 5 SEO keywords. Kenyan commercial real estate context. Mention yields, cap rates, and specific submarkets (Westlands, Upper Hill, CBD, Gigiri) where relevant. End with an author block.`;