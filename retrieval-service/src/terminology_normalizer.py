"""
Terminology & Construction Jargon Normalization module.

Normalizes domain-specific jargon, abbreviations, shorthand, and synonyms
into canonical concepts before Stage 1 Hybrid Candidate Retrieval.
"""

from typing import Dict, Any, Optional, List, Tuple
import os
import json
import re

DEFAULT_GLOSSARY_PATH = os.path.join(
    os.path.dirname(__file__), "data", "construction_glossary.json"
)

DEFAULT_ABBREVIATIONS = {
    "rebar": "reinforcement reinforcing steel",
    "r/f": "reinforcement formwork",
    "rf": "reinforcement",
    "rcc": "reinforced concrete reinforced cement concrete",
    "pcc": "plain cement concrete",
    "conc": "concrete",
    "pour": "concreting pouring",
    "pouring": "concreting pour",
    "concrtng": "concreting pouring",
    "concrting": "concreting pouring",
    "shuttering": "formwork shuttering",
    "excav": "excavation digging",
    "excvtn": "excavation",
    "excvation": "excavation",
    "psc": "prestressed concrete",
    "aac": "autoclaved aerated concrete block masonry",
    "hvac": "ductwork heating ventilation air conditioning insulation",
    "mep": "mechanical electrical plumbing",
    "m3": "cubic meters",
    "cum": "cubic meters",
    "installtn": "installation",
    "erectn": "erection",
    "substructur": "substructure",
    "superstrucure": "superstructure",
    "superstructur": "superstructure",
    "lvl": "level",
    "flr": "floor",
    "substatn": "substation",
    "substation": "substation electrical switchyard",
    "stormwtr": "stormwater",
}


DEFAULT_SYNONYMS = {
    "cement pour": "concrete pouring",
    "digging": "excavation earthwork",
    "bar bending": "rebar steel fixing reinforcement",
    "casing pipe": "bored pile casing installation",
    "torch applied": "waterproofing membrane application",
    "wearing course": "asphalt paving surface treatment",
}


DEFAULT_DISCIPLINES = {
    "rebar": "Civil",
    "r/f": "Civil",
    "rf": "Civil",
    "rcc": "Civil",
    "pcc": "Civil",
    "conc": "Civil",
    "pour": "Civil",
    "pouring": "Civil",
    "concrtng": "Civil",
    "concrting": "Civil",
    "shuttering": "Civil",
    "excav": "Civil",
    "excvtn": "Civil",
    "excvation": "Civil",
    "aac": "Civil",
    "m3": "Civil",
    "cum": "Civil",
    "substructur": "Civil",
    "psc": "Structural",
    "erectn": "Structural",
    "superstrucure": "Structural",
    "superstructur": "Structural",
    "hvac": "Piping & Utilities",
    "mep": "Piping & Utilities",
    "stormwtr": "Piping & Utilities",
    "substatn": "Electrical",
    "substation": "Electrical",
    "electn": "Electrical",
    "conduit": "Electrical",
    "cement pour": "Civil",
    "digging": "Civil",
    "bar bending": "Civil",
    "casing pipe": "Civil",
    "torch applied": "Civil",
    "wearing course": "Civil",
}


class TerminologyNormalizer:
    """
    Configurable and extensible domain normalizer that expands infrastructure/construction jargon,
    abbreviations, shorthand, and synonyms into normalized concepts with discipline tagging
    while preserving raw evidence text.
    """

    def __init__(
        self,
        glossary_path: Optional[str] = None,
        custom_abbreviations: Optional[Dict[str, str]] = None,
        custom_synonyms: Optional[Dict[str, str]] = None,
        custom_disciplines: Optional[Dict[str, str]] = None,
    ):
        self.abbreviations: Dict[str, str] = dict(DEFAULT_ABBREVIATIONS)
        self.synonyms: Dict[str, str] = dict(DEFAULT_SYNONYMS)
        self.term_disciplines: Dict[str, str] = dict(DEFAULT_DISCIPLINES)

        # 1. Load JSON glossary file if provided or available
        path_to_load = glossary_path or DEFAULT_GLOSSARY_PATH
        if os.path.exists(path_to_load):
            self.load_glossary(path_to_load)

        # 2. Apply custom runtime overrides if provided
        if custom_abbreviations:
            for k, v in custom_abbreviations.items():
                self.abbreviations[k.lower()] = v
        if custom_synonyms:
            for k, v in custom_synonyms.items():
                self.synonyms[k.lower()] = v
        if custom_disciplines:
            for k, v in custom_disciplines.items():
                self.term_disciplines[k.lower()] = v

        self._compile_patterns()

    def load_glossary(self, filepath: str) -> None:
        """
        Load glossary mappings from a JSON file, supporting both flat string values
        and structured { "expansion": "...", "discipline": "..." } entries.
        """
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)

            if "abbreviations" in data and isinstance(data["abbreviations"], dict):
                for k, v in data["abbreviations"].items():
                    k_clean = k.lower()
                    if isinstance(v, dict):
                        self.abbreviations[k_clean] = str(v.get("expansion", ""))
                        if v.get("discipline"):
                            self.term_disciplines[k_clean] = str(v["discipline"])
                    else:
                        self.abbreviations[k_clean] = str(v)

            if "synonyms" in data and isinstance(data["synonyms"], dict):
                for k, v in data["synonyms"].items():
                    k_clean = k.lower()
                    if isinstance(v, dict):
                        self.synonyms[k_clean] = str(v.get("expansion", ""))
                        if v.get("discipline"):
                            self.term_disciplines[k_clean] = str(v["discipline"])
                    else:
                        self.synonyms[k_clean] = str(v)
        except Exception:
            # Fall back gracefully to defaults
            pass

    def add_mapping(
        self, term: str, expanded: str, is_synonym: bool = False, discipline: Optional[str] = None
    ) -> None:
        """
        Add or update a normalization mapping and optional discipline tag at runtime.
        """
        term_clean = term.strip().lower()
        if is_synonym or " " in term_clean:
            self.synonyms[term_clean] = expanded
        else:
            self.abbreviations[term_clean] = expanded

        if discipline:
            self.term_disciplines[term_clean] = discipline

        self._compile_patterns()

    def get_discipline_tags(self, text: str) -> List[str]:
        """
        Extracts matched discipline tags from terms present in the text based on
        discipline-tagged glossary entries.
        """
        if not text or not text.strip():
            return []

        matched_disciplines = []
        seen = set()

        if self._syn_regex:
            for match in self._syn_regex.finditer(text):
                phrase = match.group(0).lower()
                disc = self.term_disciplines.get(phrase)
                if disc and disc not in seen:
                    seen.add(disc)
                    matched_disciplines.append(disc)

        if self._abbr_regex:
            for match in self._abbr_regex.finditer(text):
                token = match.group(0).lower()
                disc = self.term_disciplines.get(token)
                if disc and disc not in seen:
                    seen.add(disc)
                    matched_disciplines.append(disc)

        return matched_disciplines

    def _compile_patterns(self) -> None:
        """
        Compile regular expressions for efficient multi-term matching.
        """
        # Sort terms by length descending so longer phrases match before sub-phrases
        abbr_keys = sorted(self.abbreviations.keys(), key=len, reverse=True)
        syn_keys = sorted(self.synonyms.keys(), key=len, reverse=True)

        if abbr_keys:
            # Escape regex special characters e.g. R/F
            escaped_abbr = [re.escape(k) for k in abbr_keys]
            self._abbr_regex = re.compile(
                r"\b(" + "|".join(escaped_abbr) + r")\b", re.IGNORECASE
            )
        else:
            self._abbr_regex = None

        if syn_keys:
            escaped_syn = [re.escape(k) for k in syn_keys]
            self._syn_regex = re.compile(
                r"\b(" + "|".join(escaped_syn) + r")\b", re.IGNORECASE
            )
        else:
            self._syn_regex = None

    def normalize_text(self, raw_text: str, append_original: bool = True) -> str:
        """
        Generates a normalized search text string by expanding jargon and shorthand
        into canonical concepts while preserving raw evidence text.

        Args:
            raw_text: Original raw evidence string.
            append_original: If True, returns combined text containing original raw text
                             and expanded canonical concepts.

        Returns:
            Normalized search text string.
        """
        if not raw_text or not raw_text.strip():
            return raw_text

        expanded_terms = []

        # 1. Multi-word Phrase / Synonym Matching
        if self._syn_regex:
            for match in self._syn_regex.finditer(raw_text):
                phrase = match.group(0).lower()
                if phrase in self.synonyms:
                    expanded_terms.append(self.synonyms[phrase])

        # 2. Single-Word / Abbreviation Matching
        if self._abbr_regex:
            for match in self._abbr_regex.finditer(raw_text):
                token = match.group(0).lower()
                if token in self.abbreviations:
                    expanded_terms.append(self.abbreviations[token])

        if not expanded_terms:
            return raw_text

        # Deduplicate expanded concepts while preserving order
        seen = set()
        unique_expansions = []
        for exp in expanded_terms:
            for word in exp.split():
                word_clean = word.lower()
                if word_clean not in seen and word_clean not in raw_text.lower():
                    seen.add(word_clean)
                    unique_expansions.append(word)

        if not unique_expansions:
            return raw_text

        expansion_str = " ".join(unique_expansions)

        if append_original:
            return f"{raw_text} {expansion_str}"
        return expansion_str

    def normalize_with_context(
        self, raw_text: str, append_original: bool = True
    ) -> Tuple[str, List[str]]:
        """
        Returns a tuple of (normalized_text, matched_disciplines).
        """
        normalized = self.normalize_text(raw_text, append_original=append_original)
        disciplines = self.get_discipline_tags(raw_text)
        return normalized, disciplines
