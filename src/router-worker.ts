  protected readonly onStreamEvent?: TaskStreamEventCallback;
  public readonly preTaskGate: PreTaskKnowledgeGate;
  private currentAttemptController?: AbortController;
  private currentAttemptSink?: StreamEventSink;

  constructor(
    tasks?: TaskRepository,
    provider?: AgentProvider,
    name = 'router',
    onStreamEvent?: TaskStreamEventCallback,
    executionSpecDb?: ExecutionSpecDatabase,
    governance?: PdlGovernanceEngine,
    catalog?: ProductCatalog,
    remotePersistence?: PdlRemotePersistence,
    neuralBridge?: PubNeuralBridge,
    deliveryGate?: RemoteDeliveryGate,
    preTaskGate?: PreTaskKnowledgeGate,
    postTaskGate?: PostTaskExperienceGate,
  ) {
    super(tasks ?? ({} as any), name, executionSpecDb, governance, catalog, remotePersistence, neuralBridge, deliveryGate, postTaskGate, preTaskGate);
    this.provider = provider ?? ({} as any);
    this.onStreamEvent = onStreamEvent;
    this.preTaskGate = preTaskGate ?? new PreTaskKnowledgeGate();
  }

  protected emitLifecycleEvent(
    taskId: string,
    attempt: number,
    type: OperationalEventType,
    payload: Record<string, unknown>,
    sink?: StreamEventSink