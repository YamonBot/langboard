import "./ProjectWorkloadBadges.css";
import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import Popover from "@/components/base/Popover";
import Tooltip from "@/components/base/Tooltip";
import { ProjectColumn } from "@/core/models";
import { usePageNavigateRef } from "@/core/hooks/usePageNavigate";
import { ROUTES } from "@/core/routing/constants";
import { Utils } from "@langboard/core/utils";
import { workloadColumns, workloadSearch, workloadTotal } from "./ProjectWorkload";

export default function ProjectWorkloadBadges({
    projectUID,
    compact = false,
    onNavigate,
}: {
    projectUID: string;
    compact?: boolean;
    onNavigate?: () => void;
}) {
    const [t] = useTranslation();
    const navigate = usePageNavigateRef();
    const [, refresh] = useReducer((value) => value + 1, 0);
    const columns = ProjectColumn.Model.useModels((column) => column.project_uid === projectUID, [projectUID]);
    const total = workloadTotal(columns);
    const open = (columnUID?: string) => {
        navigate(`${ROUTES.BOARD.MAIN(projectUID)}${workloadSearch(columnUID)}`, { state: { commandPaletteFocus: true } });
        onNavigate?.();
    };
    const graphs = (details = false) =>
        workloadColumns(columns).map((column) => <ColumnGraph key={column.uid} column={column} details={details} onClick={() => open(column.uid)} />);
    return (
        <div
            className={`flex min-w-0 flex-wrap items-center gap-1 ${compact ? "max-w-[60%] shrink-0" : ""}`}
            onClick={(event) => event.stopPropagation()}
        >
            {columns.map((column) => (
                <CountObserver key={column.uid} column={column} refresh={refresh} />
            ))}
            {compact && total !== undefined && (
                <button
                    type="button"
                    className="project-workload-total shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums hover:bg-accent"
                    title={t("dashboard.Unfinished cards")}
                    aria-label={t("dashboard.Unfinished cards count", { count: total })}
                    onClick={() => open()}
                >
                    {total}
                </button>
            )}
            {compact
                ? total !== undefined && (
                      <>
                          <div className="project-workload-expanded">{graphs()}</div>
                          <Popover.Root>
                              <Popover.Trigger asChild>
                                  <button
                                      type="button"
                                      aria-label={t("dashboard.Unfinished by status")}
                                      className="project-workload-details rounded px-1 text-xs text-muted-foreground hover:bg-accent"
                                  >
                                      ▾
                                  </button>
                              </Popover.Trigger>
                              <Popover.Content className="flex max-w-64 flex-col gap-1">{graphs(true)}</Popover.Content>
                          </Popover.Root>
                      </>
                  )
                : graphs()}
        </div>
    );
}

function CountObserver({ column, refresh }: { column: ProjectColumn.TModel; refresh: () => void }) {
    column.useField("incomplete_count", refresh);
    column.useField("count", refresh);
    column.useField("workflow_stage", refresh);
    column.useField("is_archive", refresh);
    column.useField("order", refresh);
    column.useField("name", refresh);
    return null;
}

function ColumnGraph({ column, details, onClick }: { column: ProjectColumn.TModel; details: boolean; onClick: () => void }) {
    const [t] = useTranslation();
    const name = column.useField("name");
    const count = column.useField("incomplete_count");
    const maximum = column.useField("count");
    if (count === undefined) return null;
    const ratio = maximum > 0 ? Math.min(1, Math.max(0, count / maximum)) : 0;
    const label = `${name} · ${count}/${maximum}`;
    return (
        <Tooltip.Root>
            <Tooltip.Trigger asChild>
                <button
                    type="button"
                    onClick={onClick}
                    aria-label={t("dashboard.Unfinished in status", { status: name, count })}
                    className="flex min-w-0 items-center gap-2 rounded px-1 py-0.5 hover:bg-accent focus-visible:outline focus-visible:outline-2"
                >
                    <span
                        aria-hidden="true"
                        data-workload-column={column.uid}
                        data-workload-value={count}
                        data-workload-max={maximum}
                        className="flex h-7 w-3 shrink-0 items-end overflow-hidden rounded-sm bg-muted"
                    >
                        <span
                            className="w-full rounded-sm"
                            style={{ height: `${ratio * 100}%`, background: new Utils.Color.Generator(name).generateRandomColor() }}
                        />
                    </span>
                    {details && <span className="truncate text-xs tabular-nums">{label}</span>}
                </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content>
                    <span>{name}</span>
                    <span className="ml-2 tabular-nums">
                        {t("dashboard.Unfinished cards")} {count}/{maximum}
                    </span>
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    );
}
