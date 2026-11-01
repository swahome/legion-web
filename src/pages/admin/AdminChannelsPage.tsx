import { useEffect, useRef, useState, type FormEvent } from "react";
import { RotateCcw, Send } from "lucide-react";
import {
  channelLabels,
  screenText,
  useChannelSession,
  useChannelSessions,
  useChannels,
  useSwitchChannel,
  useTryChannel,
  type ChannelFormat,
  type ChannelKind,
} from "../../api/channels";
import { Badge, Dialog, EmptyState, ErrorState, InlineError, PageHeader, Spinner, Stat, Toggle, cx } from "../../components/ui";
import { Pager, SearchBox, formatDateTime, tbody, td, Th, theadRow, useDebounced } from "./widgets";

/** AdminChannelsPage: switch USSD and WhatsApp on or off, try the menus, and read every conversation. */
export function AdminChannelsPage() {
  return (
    <>
      <PageHeader
        title="USSD and WhatsApp"
        subtitle="Members use their group from any phone. Both channels run the same menus as the app, with the same rules."
      />
      <Switches />
      <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_1fr]">
        <TestPhone />
        <Conversations />
      </div>
    </>
  );
}

function Switches() {
  const status = useChannels();
  const save = useSwitchChannel();
  if (status.isPending) return <Spinner label="Loading" />;
  if (status.isError) return <ErrorState error={status.error} onRetry={() => status.refetch()} />;
  const s = status.data;
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
      <div className="card space-y-3 p-4">
        <Toggle
          id="ussd-on"
          label="USSD is on"
          hint="Through Africa's Talking. Off: callers hear that the service is not available."
          checked={s.ussd_enabled}
          onChange={(on) => save.mutate({ channel: "ussd", on })}
        />
      </div>
      <div className="card space-y-3 p-4">
        <Toggle
          id="whatsapp-on"
          label="WhatsApp is on"
          hint={s.whatsapp_signed ? "Through Twilio. Messages are signature checked." : "Through Twilio."}
          checked={s.whatsapp_enabled}
          onChange={(on) => save.mutate({ channel: "whatsapp", on })}
        />
        {!s.whatsapp_signed && (
          <p className="text-xs text-amber-700 dark:text-amber-400">Set LEGION_TWILIO_AUTH_TOKEN on the server so only Twilio can post messages.</p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="USSD, 7 days" value={s.last_7_days.ussd_sessions} />
        <Stat label="WhatsApp, 7 days" value={s.last_7_days.whatsapp_sessions} />
        <Stat label="Callers" value={s.last_7_days.callers} />
      </div>
      <div className="md:col-span-3">
        <InlineError error={save.error} />
      </div>
    </div>
  );
}

interface Line {
  from: "you" | "menu";
  text: string;
}

/** TestPhone runs the real menus as the signed-in admin's own number. */
function TestPhone() {
  const [format, setFormat] = useState<ChannelFormat>("ussd");
  const [session, setSession] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [ended, setEnded] = useState(false);
  const [input, setInput] = useState("");
  const step = useTryChannel();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "nearest" });
  }, [lines]);

  function send(text: string, fresh: boolean) {
    step.mutate(
      { format, session: fresh ? "" : session, input: text },
      {
        onSuccess: (r) => {
          setSession(r.session);
          setEnded(r.end);
          setLines((prev) => [...(fresh ? [] : prev), ...(text ? [{ from: "you" as const, text }] : []), { from: "menu", text: screenText(r.text) }]);
        },
      },
    );
  }

  function start(f: ChannelFormat = format) {
    setFormat(f);
    setLines([]);
    setEnded(false);
    step.mutate(
      { format: f, session: "", input: "" },
      {
        onSuccess: (r) => {
          setSession(r.session);
          setEnded(r.end);
          setLines([{ from: "menu", text: screenText(r.text) }]);
        },
      },
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !session || ended) return;
    setInput("");
    send(text, false);
  }

  return (
    <div className="card flex flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Test phone</h2>
        <select className="input w-auto py-1.5 text-sm" aria-label="Channel" value={format} onChange={(e) => start(e.target.value as ChannelFormat)}>
          <option value="ussd">USSD</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Runs the menus as your own phone number, for real: a payment sends you an MPesa prompt and a request goes to your group's signatories.
      </p>
      <div
        className={cx(
          "flex min-h-72 flex-1 flex-col gap-2 overflow-y-auto rounded-xl p-3 text-sm",
          format === "ussd" ? "bg-slate-900 font-mono text-slate-100" : "bg-emerald-50 dark:bg-emerald-950/40",
        )}
        aria-live="polite"
        data-testid="test-phone-screen"
      >
        {lines.length === 0 && !step.isPending && (
          <button className="btn-primary m-auto" onClick={() => start()}>
            {format === "ussd" ? "Dial" : "Say hi"}
          </button>
        )}
        {lines.map((l, i) => (
          <div
            key={i}
            className={cx(
              "max-w-[90%] rounded-lg px-3 py-2 whitespace-pre-wrap",
              l.from === "you" ? "self-end bg-brand-700 text-white" : format === "ussd" ? "self-start bg-slate-800" : "self-start bg-white shadow-sm dark:bg-slate-900",
            )}
          >
            {format === "whatsapp" ? l.text.replace(/^_(.+)_$/gm, "$1") : l.text}
          </div>
        ))}
        {step.isPending && <div className="self-start text-xs opacity-70">…</div>}
        {ended && <div className="self-center text-xs opacity-70">Session ended</div>}
        <div ref={bottom} />
      </div>
      <InlineError error={step.error} />
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          aria-label="Reply"
          placeholder={ended ? "Session ended" : "Reply"}
          value={input}
          disabled={!session || ended}
          onChange={(e) => setInput(e.target.value)}
          inputMode={format === "ussd" ? "numeric" : "text"}
        />
        <button className="btn-primary px-3" disabled={!session || ended || step.isPending} aria-label="Send">
          <Send className="size-4" />
        </button>
        <button type="button" className="btn-ghost px-3" onClick={() => start()} aria-label="Start again" title="Start again">
          <RotateCcw className="size-4" />
        </button>
      </form>
    </div>
  );
}

function Conversations() {
  const [channel, setChannel] = useState<ChannelKind | "">("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState(false);
  const [page, setPage] = useState(1);
  const q = useDebounced(phone.trim());
  const list = useChannelSessions({ channel, phone: q, errors, page });
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchBox
          label="Phone number"
          value={phone}
          onChange={(v) => {
            setPhone(v);
            setPage(1);
          }}
        />
        <select
          className="input w-auto"
          aria-label="Channel"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as ChannelKind | "");
            setPage(1);
          }}
        >
          <option value="">All channels</option>
          <option value="ussd">USSD</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="test">Test phone</option>
        </select>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-brand-700"
            checked={errors}
            onChange={(e) => {
              setErrors(e.target.checked);
              setPage(1);
            }}
          />
          Only with errors
        </label>
      </div>
      {list.isPending ? (
        <Spinner label="Loading conversations" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No conversations yet" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <Th>Started</Th>
                <Th>Channel</Th>
                <Th>Caller</Th>
                <Th>Group</Th>
                <Th right>Steps</Th>
                <Th />
              </tr>
            </thead>
            <tbody className={tbody}>
              {list.data.items.map((s) => (
                <tr key={s.id}>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(s.created_at)}</td>
                  <td className={td}>
                    <Badge tone={s.channel === "whatsapp" ? "brand" : "neutral"}>{channelLabels[s.channel]}</Badge>
                    {s.errors > 0 && (
                      <span className="ml-1">
                        <Badge tone="danger">Error</Badge>
                      </span>
                    )}
                  </td>
                  <td className={td}>
                    <span className="block">{s.user?.name || "Unknown number"}</span>
                    <span className="block text-xs text-slate-500">{s.phone}</span>
                  </td>
                  <td className={td}>{s.group?.name ?? "—"}</td>
                  <td className={`${td} text-right tabular-nums`}>{s.inputs}</td>
                  <td className={`${td} text-right`}>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setOpen(s.id)}>
                      Transcript
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager data={list.data} onPage={setPage} />
        </div>
      )}
      {open != null && <Transcript id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Transcript({ id, onClose }: { id: number; onClose: () => void }) {
  const s = useChannelSession(id);
  return (
    <Dialog open onClose={onClose} title="Conversation">
      {s.isPending ? (
        <Spinner />
      ) : s.isError ? (
        <ErrorState error={s.error} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {channelLabels[s.data.channel]} · {s.data.phone}
            {s.data.user && ` · ${s.data.user.name}`}
            {s.data.group && ` · ${s.data.group.name}`}
            {s.data.service_code && ` · ${s.data.service_code}`}
          </p>
          <ol className="max-h-[60vh] space-y-3 overflow-y-auto">
            {s.data.messages.map((m) => (
              <li key={m.id} className="space-y-1 text-sm">
                <div className="text-xs text-slate-500">
                  {formatDateTime(m.created_at)}
                  {m.input !== "" && (
                    <>
                      {" "}
                      · sent <span className="font-mono text-slate-700 dark:text-slate-300">{m.input}</span>
                    </>
                  )}
                </div>
                <pre className="rounded-lg bg-slate-50 p-2 font-sans whitespace-pre-wrap dark:bg-slate-950">{m.response}</pre>
                {m.error && <p className="text-xs text-red-600">{m.error}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Dialog>
  );
}
