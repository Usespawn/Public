/**
 * Vanity generation state machine (Phase 3.5 of the SpawnPad spec).
 * Explicit, tested transitions only.
 */
export enum VanityState {
  IDLE = "IDLE",
  GENERATING = "GENERATING",
  GENERATED = "GENERATED",
  VALIDATING = "VALIDATING",
  READY_TO_LAUNCH = "READY_TO_LAUNCH",
  LAUNCHING = "LAUNCHING",
  CONFIRMING = "CONFIRMING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

const TRANSITIONS: Record<VanityState, VanityState[]> = {
  [VanityState.IDLE]: [VanityState.GENERATING],
  [VanityState.GENERATING]: [
    VanityState.GENERATED,
    VanityState.CANCELLED,
    VanityState.FAILED,
  ],
  [VanityState.GENERATED]: [VanityState.VALIDATING, VanityState.IDLE],
  [VanityState.VALIDATING]: [
    VanityState.READY_TO_LAUNCH,
    VanityState.FAILED,
    VanityState.IDLE,
  ],
  [VanityState.READY_TO_LAUNCH]: [
    VanityState.LAUNCHING,
    VanityState.CANCELLED,
    VanityState.IDLE,
  ],
  [VanityState.LAUNCHING]: [VanityState.CONFIRMING, VanityState.FAILED],
  [VanityState.CONFIRMING]: [VanityState.SUCCESS, VanityState.FAILED],
  [VanityState.SUCCESS]: [VanityState.IDLE],
  [VanityState.FAILED]: [VanityState.IDLE],
  [VanityState.CANCELLED]: [VanityState.IDLE],
};

export class VanityStateError extends Error {
  constructor(
    public readonly from: VanityState,
    public readonly to: VanityState
  ) {
    super(`invalid transition ${from} → ${to}`);
  }
}

export class VanityMachine {
  #state: VanityState = VanityState.IDLE;

  get state(): VanityState {
    return this.#state;
  }

  canTransition(to: VanityState): boolean {
    return TRANSITIONS[this.#state].includes(to);
  }

  transition(to: VanityState): VanityState {
    if (!this.canTransition(to)) throw new VanityStateError(this.#state, to);
    this.#state = to;
    return this.#state;
  }
}
