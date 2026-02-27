import { ChangeDomain } from "./change-domain.js"
import type { ChangesConfig } from "./change-event.js"

export const Changes = {
  create(config?: ChangesConfig): ChangeDomain {
    return new ChangeDomain(config)
  },
}
