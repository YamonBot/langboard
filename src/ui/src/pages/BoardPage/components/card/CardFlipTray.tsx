import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Reorder } from "framer-motion";
import { useTranslation } from "react-i18next";
import useCardCommentDraftStore from "@/core/stores/CardCommentDraftStore";
import { captureCardOrigin } from "../board/CardAnimation";
import Button from "@/components/base/Button";
import IconComponent from "@/components/base/IconComponent";
import Popover from "@/components/base/Popover";
import { api } from "@/core/helpers/Api";
import { usePageNavigateRef } from "@/core/hooks/usePageNavigate";
import { ROUTES } from "@/core/routing/constants";
import { useCardFlipStore, useFlippedCards, type IFlippedCard } from "./CardFlipStore";

export default function CardFlipTray({
    userUID,
    projectUID,
    currentCard,
    disabled = false,
}: {
    userUID: string;
    projectUID: string;
    currentCard?: IFlippedCard;
    disabled?: boolean;
}) {
    const cards = useFlippedCards(userUID, projectUID);
    const drafts = useCardCommentDraftStore((state) => state.draftMap);
    const hasDraft = (card: IFlippedCard) =>
        !!(drafts[`comment-${projectUID}-${card.uid}`] ?? useCardCommentDraftStore.getState().getDraft(projectUID, card.uid)).trim();
    const navigate = usePageNavigateRef();
    const [t] = useTranslation();
    const host = useRef<HTMLDivElement>(null);
    const overflowTrigger = useRef<HTMLButtonElement>(null);
    const restoreFocusAfterEscape = useRef(false);
    const [capacity, setCapacity] = useState(0);
    const [open, setOpen] = useState(false);
    const identities = JSON.stringify(cards.map((card) => card.uid).sort());

    useEffect(() => {
        if (!host.current) return;
        const update = () => {
            const width = host.current!.getBoundingClientRect().width;
            setCapacity(window.innerWidth < 768 ? 0 : Math.max(0, Math.min(5, Math.floor((width - 56) / 120))));
        };
        const observer = new ResizeObserver(update);
        observer.observe(host.current);
        update();
        return () => observer.disconnect();
    }, [cards.length]);

    useEffect(() => {
        const uids = JSON.parse(identities) as string[];
        if (!uids.length) return;
        const controller = new AbortController();
        let running = false;
        const validate = async () => {
            if (running || controller.signal.aborted) return;
            running = true;
            try {
                const available = new Set<string>();
                for (let offset = 0; offset < uids.length; offset += 200) {
                    const response = await api.post<{ card_uids: string[] }>(
                        `/board/${encodeURIComponent(projectUID)}/cards/available`,
                        { card_uids: uids.slice(offset, offset + 200) },
                        { signal: controller.signal, env: { interceptToast: true } as never }
                    );
                    if (!Array.isArray(response.data.card_uids) || !response.data.card_uids.every((uid) => typeof uid === "string")) return;
                    response.data.card_uids.forEach((uid) => available.add(uid));
                }
                if (!controller.signal.aborted && uids.some((uid) => !available.has(uid)))
                    useCardFlipStore.getState().retain(userUID, projectUID, available);
            } catch (error) {
                if (!controller.signal.aborted && isAxiosError(error) && error.response?.status === 403)
                    useCardFlipStore.getState().retain(userUID, projectUID, new Set());
            } finally {
                running = false;
            }
        };
        void validate();
        window.addEventListener("focus", validate);
        return () => {
            controller.abort();
            window.removeEventListener("focus", validate);
        };
    }, [userUID, projectUID, identities]);

    if (!cards.length) return null;
    const select = (card: IFlippedCard, element: HTMLElement) => {
        if (disabled) return;
        captureCardOrigin(projectUID, card.uid, element.getBoundingClientRect());
        useCardFlipStore.getState().swap(userUID, projectUID, card.uid, currentCard);
        setOpen(false);
        navigate({ pathname: ROUTES.BOARD.CARD(projectUID, card.uid), search: window.location.search });
    };
    const item = (card: IFlippedCard, compact = true) => (
        <Reorder.Item
            value={card}
            dragListener={!disabled}
            data-card-flip-item={card.uid}
            className="relative flex min-w-0 items-center gap-0.5 rounded-xl border border-border/70 bg-muted/35"
        >
            <Button
                variant="ghost"
                className={
                    compact
                        ? "h-9 min-w-0 flex-1 justify-start gap-1 rounded-full px-2"
                        : "h-auto min-h-9 min-w-0 flex-1 justify-start gap-1 rounded-xl px-2"
                }
                disabled={disabled}
                title={compact ? card.title : undefined}
                aria-label={t("card.Restore flipped card", { title: card.title })}
                onClick={(event) => select(card, event.currentTarget)}
            >
                <IconComponent icon="square-kanban" size="4" />
                {hasDraft(card) && (
                    <span
                        data-card-flip-unsaved=""
                        aria-label={t("card.unsavedChanges.Keep editing")}
                        className="size-1.5 shrink-0 rounded-full bg-amber-400"
                    />
                )}
                <span className={compact ? "truncate" : "whitespace-normal break-words text-left"}>{card.title}</span>
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-full"
                disabled={disabled}
                aria-label={t("card.Remove flipped card", { title: card.title })}
                onClick={() => useCardFlipStore.getState().remove(userUID, projectUID, card.uid)}
            >
                <IconComponent icon="x" size="3" />
            </Button>
        </Reorder.Item>
    );
    const visible = cards.slice(0, capacity);
    const overflow = cards.slice(capacity);
    return (
        <div ref={host} data-card-flip-tray="" className="flex min-w-0 max-w-[35vw] items-center gap-1 md:w-[min(35vw,40rem)]">
            <span role="separator" aria-orientation="vertical" className="mx-1 h-6 w-px shrink-0 bg-border" />
            <Reorder.Group
                axis="x"
                values={visible}
                onReorder={(ordered) =>
                    useCardFlipStore.getState().reorder(
                        userUID,
                        projectUID,
                        [...ordered, ...overflow].map((card) => card.uid)
                    )
                }
                className="flex min-w-0 gap-1"
            >
                {visible.map((card) => (
                    <div key={card.uid} className="w-[116px] min-w-0 shrink-0">
                        {item(card)}
                    </div>
                ))}
            </Reorder.Group>
            {overflow.length > 0 && (
                <Popover.Root open={open} onOpenChange={setOpen}>
                    <Popover.Trigger asChild>
                        <Button
                            ref={overflowTrigger}
                            variant="ghost"
                            className="h-10 shrink-0 gap-1 rounded-full px-2"
                            disabled={disabled}
                            aria-label={t("card.Flipped cards", { count: cards.length })}
                        >
                            <IconComponent icon="layers" size="4" />
                            <span>{capacity ? `+${overflow.length}` : cards.length}</span>
                        </Button>
                    </Popover.Trigger>
                    <Popover.Content
                        side="top"
                        align="end"
                        className="z-[9999999] max-h-[60dvh] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto p-2"
                        onEscapeKeyDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            restoreFocusAfterEscape.current = true;
                            setOpen(false);
                        }}
                        onCloseAutoFocus={(event) => {
                            if (!restoreFocusAfterEscape.current) return;
                            event.preventDefault();
                            restoreFocusAfterEscape.current = false;
                            overflowTrigger.current?.focus({ preventScroll: true });
                        }}
                    >
                        <p className="px-2 pb-2 text-xs text-muted-foreground">{t("card.Flipped cards", { count: cards.length })}</p>
                        <Reorder.Group
                            axis="y"
                            values={cards}
                            onReorder={(ordered) =>
                                useCardFlipStore.getState().reorder(
                                    userUID,
                                    projectUID,
                                    ordered.map((card) => card.uid)
                                )
                            }
                            className="space-y-1"
                        >
                            {cards.map((card) => item(card, false))}
                        </Reorder.Group>
                    </Popover.Content>
                </Popover.Root>
            )}
        </div>
    );
}
