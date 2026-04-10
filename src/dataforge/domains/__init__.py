from dataforge.domains.ecommerce import EcommerceDomain
from dataforge.domains.finance import FinanceDomain
from dataforge.domains.hr import HrDomain

DOMAIN_REGISTRY: dict[str, type] = {
    "ecommerce": EcommerceDomain,
    "hr": HrDomain,
    "finance": FinanceDomain,
}
