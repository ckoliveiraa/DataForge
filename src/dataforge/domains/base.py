from abc import ABC, abstractmethod

from dataforge.core.schema import DomainSchema


class DomainTemplate(ABC):
    @abstractmethod
    def get_schema(self) -> DomainSchema: ...
