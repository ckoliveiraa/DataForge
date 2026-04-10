from dataforge.domains.ecommerce import EcommerceDomain
from dataforge.domains.hr import HrDomain
from dataforge.domains.finance import FinanceDomain

DOMAIN_REGISTRY: dict[str, type] = {
    "ecommerce": EcommerceDomain,
    "hr": HrDomain,
    "finance": FinanceDomain,
}
