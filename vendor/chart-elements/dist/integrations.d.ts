import * as React from 'react';

type AdapterStatus = "idle" | "submitting" | "success" | "error";
type PowerAppsSubmitResult = {
    id: string;
    message: string;
};
type PowerAppsAdapter = {
    name: string;
    submit: (values: Record<string, string>) => Promise<PowerAppsSubmitResult>;
};
type PowerAppsVisualProps = {
    adapter?: PowerAppsAdapter;
    /** Enables the explicit local mock used by the documentation gallery. */
    mock?: boolean;
    value?: Record<string, string>;
    defaultValue?: Record<string, string>;
    onValueChange?: (values: Record<string, string>) => void;
    onSubmitted?: (result: PowerAppsSubmitResult) => void;
    className?: string;
};
type PowerAutomateRunResult = {
    runId: string;
    status: "queued" | "succeeded";
    message: string;
};
type PowerAutomateAdapter = {
    name: string;
    trigger: (flowId: string, payload: Record<string, string>) => Promise<PowerAutomateRunResult>;
};
type PowerAutomateVisualProps = {
    flowId: string;
    adapter?: PowerAutomateAdapter;
    /** Enables the explicit local mock used by the documentation gallery. */
    mock?: boolean;
    defaultPayload?: Record<string, string>;
    onRunComplete?: (result: PowerAutomateRunResult) => void;
    className?: string;
};
declare function PowerAppsVisual({ adapter, mock, value, defaultValue, onValueChange, onSubmitted, className, }: PowerAppsVisualProps): React.JSX.Element;
declare function PowerAutomateVisual({ flowId, adapter, mock, defaultPayload, onRunComplete, className, }: PowerAutomateVisualProps): React.JSX.Element;

export { type AdapterStatus, type PowerAppsAdapter, type PowerAppsSubmitResult, PowerAppsVisual, type PowerAppsVisualProps, type PowerAutomateAdapter, type PowerAutomateRunResult, PowerAutomateVisual, type PowerAutomateVisualProps };
