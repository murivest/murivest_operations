// src/app/training.$moduleId.tsx  (route: /_authenticated/app/training/$moduleId)
// $moduleId = the module code from trainingAcademy.ts: M1, M2, … M12
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Download,
  FileText,
  FolderOpen,
  Link2,
  PlayCircle,
  Sheet,
  Video,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listTrainingModules, listTrainingProgress, newTables } from "@/lib/queries";
import { friendlyError } from "@/lib/format";
import { getModule, MODULES } from "@/lib/trainingAcademy";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/app/training/$moduleId")({
  component: TrainingModulePage,
  errorComponent: ({ error }) => (
    <div className="space-y-6">
      <PageHeader title="Training module" description="Something went wrong loading this module." />
      <Panel title="Error">
        <p className="text-sm text-destructive">{(error as { message?: string })?.message ?? String(error)}</p>
      </Panel>
      <Button asChild size="sm" variant="outline">
        <Link to="/app/training">Back to academy</Link>
      </Button>
    </div>
  ),
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const lessonKey = (mod: string, lesson: string) => `mv-lesson-${mod}-${lesson}`;

function isRemoteVideo(url: string) {
  return /^(https?:)?\/\//.test(url);
}

function VideoEmbed({ url, title }: { url: string; title: string }) {
  if (isRemoteVideo(url)) {
    // YouTube / Drive / Vimeo embed — paste a full share URL in the data file
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    const src = yt
      ? `https://www.youtube.com/embed/${yt[1]}`
      : url.replace("/view?usp=sharing", "/preview").replace("/view", "/preview");
    return (
      <div className="aspect-video w-full rounded-md overflow-hidden border bg-black">
        <iframe
          src={src}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <video controls preload="metadata" className="w-full rounded-md border bg-black aspect-video">
      <source src={url} />
      Your browser does not support the video tag.
    </video>
  );
}

function ResourceRow({ r }: { r: { type: string; title: string; url: string; description?: string } }) {
  const icon =
    r.type === "pdf" ? <FileText className="h-4 w-4" /> :
    r.type === "sheet" ? <Sheet className="h-4 w-4" /> :
    r.type === "video" ? <Video className="h-4 w-4" /> :
    r.type === "folder" ? <FolderOpen className="h-4 w-4" /> :
    r.type === "link" ? <Link2 className="h-4 w-4" /> :
    <FileText className="h-4 w-4" />;
  return (
    <a
      href={r.url}
      download={!isRemoteVideo(r.url)}
      target={isRemoteVideo(r.url) ? "_blank" : undefined}
      rel="noreferrer"
      className="flex items-start gap-3 rounded-md border p-3 hover:bg-accent transition-colors"
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{r.title}</span>
        {r.description && (
          <span className="block text-xs text-muted-foreground mt-0.5">{r.description}</span>
        )}
      </span>
      <Download className="h-4 w-4 text-muted-foreground mt-0.5" />
    </a>
  );
}

function CopyBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-xs leading-relaxed max-h-72 overflow-y-auto">
        {text}
      </pre>
      <Button
        size="sm"
        variant="outline"
        className="absolute top-2 right-2"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <ClipboardCopy className="h-3.5 w-3.5 mr-1" />
        {copied ? "Copied" : label}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function TrainingModulePage() {
  let moduleId: string | undefined;
  try {
    moduleId = useParams({ from: "/_authenticated/app/training/$moduleId" }).moduleId;
  } catch {
    moduleId = undefined;
  }
  if (!moduleId && typeof window !== "undefined") {
    const segs = window.location.pathname.split("/").filter(Boolean);
    moduleId = segs[segs.length - 1];
  }
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const mod = getModule(moduleId ?? "");
  const [assessmentScore, setAssessmentScore] = useState("");
  const [, forceRender] = useState(0);

  const idx = MODULES.findIndex((m) => m.code === mod?.code);
  const prev = idx > 0 ? MODULES[idx - 1] : null;
  const next = idx >= 0 && idx < MODULES.length - 1 ? MODULES[idx + 1] : null;

  const { data: dbModules } = useQuery({
    queryKey: ["training-modules"],
    queryFn: listTrainingModules,
  });
  const dbRow = (dbModules ?? []).find((m) => m.module_number === mod?.moduleNumber);

  const { data: dbProgress, isLoading } = useQuery({
    queryKey: ["training-progress", mod?.code],
    queryFn: async () => {
      if (!dbRow) return null;
      const { data, error } = await newTables
        .from("training_progress")
        .select("*")
        .eq("module_id", dbRow.id)
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!dbRow,
  });

  const localAssessment = (() => {
    if (typeof window === "undefined" || !mod) return null;
    const raw = localStorage.getItem(`mv-assessment-${mod.moduleNumber}`);
    return raw ? (JSON.parse(raw) as { status: string; score: number | null; attempts: number }) : null;
  })();

  const progress = dbRow
    ? dbProgress
    : localAssessment
      ? { status: localAssessment.status, score: localAssessment.score, attempts: localAssessment.attempts }
      : null;

  const markLesson = (lessonId: string, val: boolean) => {
    if (!mod) return;
    localStorage.setItem(lessonKey(mod.code, lessonId), val ? "1" : "0");
    forceRender((n) => n + 1);
  };

  const submitAssessment = useMutation({
    mutationFn: async (score: number) => {
      const passed = score >= mod!.passMark;
      const attempts = (progress?.attempts ?? 0) + 1;
      if (dbRow) {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error("Not signed in.");
        const { error } = await newTables.from("training_progress").upsert(
          {
            user_id: auth.user.id,
            module_id: dbRow.id,
            status: passed ? "completed" : "in_progress",
            score,
            attempts,
            completed_at: passed ? new Date().toISOString() : null,
          },
          { onConflict: "user_id, module_id" },
        );
        if (error) throw error;
        const { error: aErr } = await newTables.from("training_assessments").insert({
          user_id: auth.user.id,
          module_id: dbRow.id,
          score,
          passed,
          attempt_number: attempts,
        });
        if (aErr) throw aErr;
      } else {
        localStorage.setItem(
          `mv-assessment-${mod!.moduleNumber}`,
          JSON.stringify({ status: passed ? "completed" : "in_progress", score, attempts }),
        );
      }
    },
    onSuccess: () => {
      toast.success("Assessment submitted.");
      queryClient.invalidateQueries({ queryKey: ["training-progress"] });
      forceRender((n) => n + 1);
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to submit assessment.")),
  });

  if (!mod) {
    return (
      <EmptyState
        message={`Training module not found${moduleId ? ` (${moduleId})` : ""}.`}
        hint="Open the Training academy and click 'Start module' on a module."
      />
    );
  }
  if (dbRow && isLoading) return <LoadingState label="Loading training module…" />;

  const done = progress?.status === "completed";
  const attemptsUsed = progress?.attempts ?? 0;
  const canAttempt = attemptsUsed < mod.maxAttempts || done;
  const lessonsDoneCount = typeof window === "undefined"
    ? 0
    : mod.lessons.filter((l) => localStorage.getItem(lessonKey(mod.code, l.id)) === "1").length;
  const lessonPct = Math.round((lessonsDoneCount / mod.lessons.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Module ${mod.moduleNumber} — ${mod.title}`}
        description={mod.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {prev && (
              <Button asChild size="sm" variant="outline">
                <Link to="/app/training/$moduleId" params={{ moduleId: prev.code }}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> {prev.code}
                </Link>
              </Button>
            )}
            {next && (
              <Button asChild size="sm" variant="outline">
                <Link to="/app/training/$moduleId" params={{ moduleId: next.code }}>
                  {next.code} <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link to="/app/training">Back to academy</Link>
            </Button>
          </div>
        }
      />

      {/* Overview */}
      <Panel title="Module overview">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
          <StatusBadge tone={done ? "success" : progress?.status === "in_progress" ? "info" : "neutral"}>
            {done ? "Completed" : progress?.status === "in_progress" ? "In progress" : "Not started"}
          </StatusBadge>
          {mod.mandatory && <StatusBadge tone="warning">Mandatory</StatusBadge>}
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {mod.duration}</span>
          <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {mod.lessons.length} lessons</span>
          <span>Pass mark {mod.passMark}%</span>
          <span>{mod.maxAttempts} attempts</span>
          {progress?.score != null && <span className="font-mono">Score: {progress.score}%</span>}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>Lesson progress</span>
          <span>{lessonsDoneCount}/{mod.lessons.length} · {lessonPct}%</span>
        </div>
        <Progress value={lessonPct} className="h-1.5" />
      </Panel>

      {/* Zoom recording */}
      {mod.zoomRecordingUrl && (
        <Panel title="Zoom session recording">
          <VideoEmbed url={mod.zoomRecordingUrl} title={`${mod.code} Zoom recording`} />
          <p className="text-xs text-muted-foreground mt-2">
            Watch the full facilitated session for this module, then work through the lessons below.
          </p>
        </Panel>
      )}

      {/* Facilitator script */}
      <Panel title="Facilitator script (Zoom session)">
        <CopyBlock text={mod.zoomScript} label="Copy script" />
      </Panel>

      {/* Slide deck prompt */}
      <Panel title="Presentation prompt — generate the deck with Claude">
        <p className="text-xs text-muted-foreground mb-3">
          Paste this into Claude to generate the slide deck and speaker notes for this module&apos;s
          Zoom session. Review output against the brand standard before presenting.
        </p>
        <CopyBlock text={mod.slideDeckPrompt} label="Copy prompt" />
      </Panel>

      {/* Lessons */}
      <Panel title="Lessons">
        <div className="space-y-4">
          {mod.lessons.map((l, i) => {
            const lDone = typeof window === "undefined" ? false : localStorage.getItem(lessonKey(mod.code, l.id)) === "1";
            return (
              <div key={l.id} className="rounded-md border">
                <div className="flex items-center justify-between gap-3 p-3 border-b bg-muted/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm font-medium truncate">{l.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">· {l.duration}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={lDone ? "outline" : "default"}
                    onClick={() => markLesson(l.id, !lDone)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {lDone ? "Completed" : "Mark complete"}
                  </Button>
                </div>
                <div className="p-3 space-y-3">
                  {l.videoUrl && <VideoEmbed url={l.videoUrl} title={l.title} />}
                  <div className="prose-sm text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {l.content}
                  </div>
                  {l.resources && l.resources.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Downloads</p>
                      {l.resources.map((r) => (
                        <ResourceRow key={r.id} r={r} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Module-level resources */}
      {mod.resources.length > 0 && (
        <Panel title="Module documents & downloads">
          <div className="space-y-2">
            {mod.resources.map((r) => (
              <ResourceRow key={r.id} r={r} />
            ))}
          </div>
        </Panel>
      )}

      {/* Assessment */}
      {!done && canAttempt && (
        <Panel title="Assessment">
          <p className="text-sm text-muted-foreground mb-4">
            Pass mark: {mod.passMark}% · Attempts remaining: {mod.maxAttempts - attemptsUsed} of{" "}
            {mod.maxAttempts}
          </p>
          <div className="space-y-3 max-w-md">
            <label className="block space-y-1.5">
              <span className="label-caps block">Your score (%)</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={assessmentScore}
                onChange={(e) => setAssessmentScore(e.target.value)}
                placeholder="e.g. 85"
              />
            </label>
            <Button
              onClick={() => {
                const s = Number(assessmentScore);
                if (!s || s < 0 || s > 100) {
                  toast.error("Enter a valid score between 0 and 100.");
                  return;
                }
                submitAssessment.mutate(s);
              }}
              disabled={submitAssessment.isPending || !assessmentScore}
            >
              <PlayCircle className="h-4 w-4 mr-1" />
              {submitAssessment.isPending ? "Submitting…" : "Submit assessment"}
            </Button>
          </div>
        </Panel>
      )}

      {done && (
        <Panel title="Module completed" className="border-success">
          <p className="text-sm text-success">
            You scored {progress?.score}% and completed Module {mod.moduleNumber}.{" "}
            {next ? "Proceed to the next module when ready." : "You have completed the academy."}
          </p>
        </Panel>
      )}

      {!canAttempt && !done && (
        <Panel title="Attempts exhausted" className="border-destructive">
          <p className="text-sm text-muted-foreground">
            You have used all {mod.maxAttempts} attempts for this module. Contact an administrator
            to request reassignment.
          </p>
        </Panel>
      )}

      {done && role === "junior_capital_advisor" && mod.code === "M12" && (
        <Panel title="Academy complete" className="border-success">
          <p className="text-sm text-success">
            All 12 modules complete. Your operational access — content publishing and property
            publishing — will be confirmed by an administrator.
          </p>
        </Panel>
      )}
    </div>
  );
}