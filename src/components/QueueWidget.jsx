import React, { useState, useEffect } from 'react';
import {
  Users,
  Download,
  Clock,
  ShieldCheck,
  Flame,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { useQueue } from '../context/QueueContext';
import { formatEta } from '../utils/formatters';

export default function QueueWidget({ onCancelDownload }) {
  const { queueState, priorityQuota, usePriority, cancelDownloadSlot } = useQueue();
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [priorityBusy, setPriorityBusy] = useState(false);
  const [priorityError, setPriorityError] = useState(null);

  const active = queueState?.active || [];
  const waiting = queueState?.waiting || [];
  const yourActive = queueState?.yourActiveSlot || null;
  const yourWaiting = queueState?.yourWaitingTicket || null;

  const hasActivity = active.length > 0 || waiting.length > 0;

  // Tick every 500ms while active grace countdowns exist so the 7s timer counts down smoothly
  useEffect(() => {
    const hasGrace = active.some((a) => a.status === 'grace' || a.status === 'granted');
    if (!hasGrace) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [active]);

  // Auto-expand whenever the current user enters the queue or becomes active
  useEffect(() => {
    if (yourWaiting || yourActive) {
      setCollapsed(false);
    }
  }, [Boolean(yourWaiting), Boolean(yourActive)]);

  if (!hasActivity) return null;

  const handlePriorityClick = async () => {
    setPriorityBusy(true);
    setPriorityError(null);
    try {
      await usePriority();
    } catch (err) {
      setPriorityError(err.message);
      setTimeout(() => setPriorityError(null), 4000);
    } finally {
      setPriorityBusy(false);
    }
  };

  const handleCancelWaiting = async () => {
    if (onCancelDownload) {
      onCancelDownload();
    } else {
      await cancelDownloadSlot();
    }
  };

  const slotsInfo = queueState?.slots || { activeDownloads: active.length, maxDownloads: 4 };

  return (
    <div className="w-[calc(100vw-2rem)] max-w-sm sm:w-[380px] bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-xl shadow-2xl text-zinc-100 overflow-hidden transition-all duration-200">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 bg-zinc-950/60 hover:bg-zinc-950/90 border-b border-zinc-800/80 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/70 flex items-center justify-center text-blue-400 flex-shrink-0">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-200">Fronta stahování</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                {queueState?.mode || '4/1'}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 font-mono truncate">
              {yourWaiting ? (
                <span className={yourWaiting.hasPriority ? 'text-orange-300 font-medium' : 'text-amber-300'}>
                  Tvoje pozice: #{yourWaiting.position} ve frontě
                </span>
              ) : yourActive ? (
                <span className="text-emerald-400">
                  {yourActive.status === 'downloading'
                    ? 'Aktivní přenos (imunita)'
                    : 'Slot připraven'}
                </span>
              ) : (
                <span>
                  {slotsInfo.activeDownloads}/{slotsInfo.maxDownloads} aktivních
                  {waiting.length > 0 ? ` • ${waiting.length} čeká` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-400 flex-shrink-0">
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="p-3 space-y-2.5 max-h-72 overflow-y-auto">
          {/* Active slots */}
          {active.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-0.5">
                Aktivní připojení ({active.length}/{slotsInfo.maxDownloads})
              </div>
              {active.map((entry) => {
                const graceSec =
                  entry.status === 'grace' && entry.graceEndsAt
                    ? Math.max(0, Math.ceil((entry.graceEndsAt - now) / 1000))
                    : entry.graceRemainingSeconds;
                const etaStr = formatEta(entry.etaSeconds);
                const hasPercent = typeof entry.percent === 'number';

                let statusSubtitle = 'Připravuje stahování…';
                if (entry.status === 'downloading') {
                  statusSubtitle = entry.isYou ? 'Stahuješ' : 'Něco stahuje';
                } else if (entry.status === 'grace') {
                  statusSubtitle = 'Dokončeno';
                }

                return (
                  <div
                    key={`active-${entry.slot}-${entry.label}`}
                    className={`rounded-lg text-xs border overflow-hidden ${
                      entry.hasPriority
                        ? 'priority-fire-row'
                        : entry.isYou
                        ? 'bg-blue-950/35 border-blue-700/50 text-zinc-100'
                        : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {entry.hasPriority ? (
                          <Flame className="w-3.5 h-3.5 text-orange-400 priority-flame-icon flex-shrink-0" />
                        ) : (
                          <Download
                            className={`w-3.5 h-3.5 flex-shrink-0 ${
                              entry.status === 'downloading'
                                ? 'text-emerald-400 animate-pulse'
                                : 'text-amber-400'
                            }`}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-medium truncate ${entry.isYou ? 'text-blue-300' : 'text-zinc-200'}`}>
                              {entry.label}
                            </span>
                            {entry.hasPriority && (
                              <span className="text-[9px] font-mono font-semibold px-1 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40">
                                PRIORITA
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500">{statusSubtitle}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 font-mono text-[11px]">
                        {entry.status === 'downloading' ? (
                          <div className="flex items-center gap-1.5 text-emerald-400" title="Aktivní stahování (imunita)">
                            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>
                              {hasPercent ? `${entry.percent} %` : '…'}
                              {etaStr ? ` • ${etaStr}` : ''}
                            </span>
                          </div>
                        ) : entry.status === 'grace' ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium text-[10px]"
                            title="Čas do automatického odpojení slotu při nečinnosti"
                          >
                            <Clock className="w-3 h-3" />
                            <span>{graceSec ?? 0}s</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">Startuji…</span>
                        )}
                      </div>
                    </div>

                    {/* Sleek 2px progress bar while downloading */}
                    {entry.status === 'downloading' && hasPercent && (
                      <div className="w-full h-0.5 bg-zinc-800/80">
                        <div
                          className={`h-full transition-all duration-300 ${
                            entry.hasPriority ? 'bg-orange-400' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(4, Math.min(100, entry.percent))}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Waiting queue */}
          {waiting.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-0.5">
                Čekající ve frontě ({waiting.length})
              </div>
              {waiting.map((ticket) => (
                <div
                  key={ticket.ticketId}
                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs border ${
                    ticket.hasPriority
                      ? 'priority-fire-row'
                      : ticket.isYou
                      ? 'bg-amber-950/30 border-amber-700/50 text-zinc-100'
                      : 'bg-zinc-950/40 border-zinc-800/70 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[11px] font-mono font-semibold w-5 text-center flex-shrink-0 ${
                        ticket.hasPriority ? 'text-orange-300' : 'text-zinc-400'
                      }`}
                    >
                      #{ticket.position}
                    </span>

                    {ticket.hasPriority && (
                      <Flame className="w-3.5 h-3.5 text-orange-400 priority-flame-icon flex-shrink-0" />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-medium ${ticket.isYou ? 'text-amber-200' : 'text-zinc-200'}`}>
                          {ticket.label}
                        </span>
                        {ticket.hasPriority && (
                          <span className="text-[9px] font-mono font-semibold px-1 rounded bg-orange-500/20 text-orange-200 border border-orange-500/40">
                            PRIORITA
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500">Čeká ve frontě</div>
                    </div>
                  </div>

                  {ticket.isYou && (
                    <button
                      type="button"
                      onClick={handleCancelWaiting}
                      title="Opustit frontu"
                      className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80 transition-colors cursor-pointer flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Priority error alert */}
          {priorityError && (
            <div className="px-2.5 py-1.5 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-[11px]">
              {priorityError}
            </div>
          )}

          {/* Interactive Priority Button when waiting */}
          {yourWaiting && (
            <div className="pt-1 border-t border-zinc-800/80 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handlePriorityClick}
                disabled={
                  priorityBusy ||
                  yourWaiting.hasPriority ||
                  yourWaiting.position <= 1 ||
                  priorityQuota.remaining <= 0
                }
                title={
                  yourWaiting.hasPriority
                    ? 'Priorita už je pro toto stahování aktivní'
                    : yourWaiting.position <= 1
                    ? 'Už jsi první na řadě hned za aktivními uživateli'
                    : priorityQuota.remaining <= 0
                    ? 'Týdenní limit 3× Priority byl vyčerpán (obnoví se v pondělí)'
                    : 'Posune tě ve frontě hned pod posledního aktivního člena'
                }
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  yourWaiting.hasPriority
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-200 cursor-default'
                    : priorityQuota.remaining <= 0 || yourWaiting.position <= 1
                    ? 'bg-zinc-800/60 border-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 border-orange-400/50 text-white shadow-lg shadow-orange-950/40'
                }`}
              >
                <Flame
                  className={`w-3.5 h-3.5 ${
                    !yourWaiting.hasPriority && priorityQuota.remaining > 0 && yourWaiting.position > 1
                      ? 'priority-flame-icon'
                      : ''
                  }`}
                />
                <span>
                  {yourWaiting.hasPriority
                    ? 'Priorita aktivní'
                    : yourWaiting.position <= 1
                    ? 'Jsi první na řadě'
                    : priorityBusy
                    ? 'Aktivuji…'
                    : `Priorita (${priorityQuota.remaining}/${priorityQuota.max} týdně)`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
