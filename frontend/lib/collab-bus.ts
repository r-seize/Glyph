// Module-level singleton that bridges the active WebSocket send function
// with mutation hooks that need to broadcast invalidations to the room.
// Only one WS connection is active at a time (one editor open per tab).

type SendFn = (msg: object) => void;

let _send: SendFn | null = null;

export const collabBus = {
    register(fn: SendFn): void {
        _send = fn;
    },

    unregister(): void {
        _send = null;
    },

    send(msg: object): void {
        _send?.(msg);
    },
};
