import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { query, type Paged } from "./admin";
import { api } from "./client";
import type { NamedRef } from "./money";

// USSD and WhatsApp (milestone 7). See legion-api docs/api/channels.md.

export type ChannelKind = "ussd" | "whatsapp" | "test";
export type ChannelFormat = "ussd" | "whatsapp";

export const channelLabels: Record<ChannelKind, string> = {
  ussd: "USSD",
  whatsapp: "WhatsApp",
  test: "Test phone",
};

export interface ChannelsStatus {
  configured: boolean;
  ussd_enabled: boolean;
  whatsapp_enabled: boolean;
  whatsapp_signed: boolean;
  last_7_days: { ussd_sessions: number; whatsapp_sessions: number; callers: number };
}

export interface ChannelSession {
  id: number;
  channel: ChannelKind;
  phone: string;
  user: NamedRef | null;
  group: NamedRef | null;
  screen: string;
  inputs: number;
  errors: number;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelMessage {
  id: number;
  input: string;
  response: string;
  error: string;
  created_at: string;
}

export interface ChannelSessionDetail extends Omit<ChannelSession, "screen" | "errors"> {
  service_code: string;
  expires_at: string;
  messages: ChannelMessage[];
}

export interface TryReply {
  session: string;
  text: string;
  end: boolean;
}

const a = "/v1/admin";

export function useChannels() {
  return useQuery({ queryKey: ["admin", "channels"], queryFn: () => api.get<ChannelsStatus>(`${a}/channels`) });
}

/** useSwitchChannel turns USSD or WhatsApp on or off (platform setting channels.<name>.enabled). */
export function useSwitchChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, on }: { channel: ChannelFormat; on: boolean }) =>
      api.patch(`${a}/settings`, { [`channels.${channel}.enabled`]: on }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "channels"] });
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });
}

export function useChannelSessions(params: { channel?: string; phone?: string; errors?: boolean; page?: number }) {
  return useQuery({
    queryKey: ["admin", "channel-sessions", params],
    queryFn: () => api.get<Paged<ChannelSession>>(`${a}/channel-sessions${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useChannelSession(id: number | null) {
  return useQuery({
    queryKey: ["admin", "channel-sessions", id],
    queryFn: () => api.get<ChannelSessionDetail>(`${a}/channel-sessions/${id}`),
    enabled: id != null,
  });
}

/** useTryChannel sends one step from the admin's test phone. */
export function useTryChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { format: ChannelFormat; session?: string; input?: string }) => api.post<TryReply>(`${a}/channels/try`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "channel-sessions"] }),
  });
}

/** screenText drops the USSD "CON "/"END " prefix for showing. */
export function screenText(text: string): string {
  return text.replace(/^(CON|END) /, "");
}
