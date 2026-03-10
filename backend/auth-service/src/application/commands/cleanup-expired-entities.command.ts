export class CleanupExpiredEntitiesCommand {
  constructor(public readonly dryRun: boolean = false) {}
}
