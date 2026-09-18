"""
Unit tests for Terminology & Construction Jargon Normalizer module.
"""

import pytest
import os
import json
import tempfile

try:
    from apps.retrieval.src.terminology_normalizer import TerminologyNormalizer
except ImportError:
    from src.terminology_normalizer import TerminologyNormalizer


@pytest.fixture
def normalizer():
    return TerminologyNormalizer()


def test_abbreviation_expansion(normalizer):
    raw_text = "rebar cage tying and shuttering for RCC pier foundation"
    normalized = normalizer.normalize_text(raw_text, append_original=True)

    # Must preserve original text
    assert raw_text in normalized
    # Must contain expanded canonical concepts
    assert "reinforcement" in normalized.lower()
    assert "formwork" in normalized.lower()
    assert "reinforced concrete" in normalized.lower()


def test_jargon_terms_expansion(normalizer):
    test_cases = [
        ("conc pour for slab span 1", ["concrete", "pouring"]),
        ("excav work ongoing", ["excavation"]),
        ("PSC girder launched", ["prestressed concrete"]),
        ("AAC block wall construction", ["autoclaved aerated concrete"]),
        ("HVAC ducting installed", ["heating ventilation air conditioning"]),
    ]

    for raw, expected_keywords in test_cases:
        normalized = normalizer.normalize_text(raw)
        assert raw in normalized
        for keyword in expected_keywords:
            assert keyword in normalized.lower()


def test_case_insensitivity(normalizer):
    raw1 = "RCC pier concreting"
    raw2 = "rcc pier CONCRTING"

    norm1 = normalizer.normalize_text(raw1)
    norm2 = normalizer.normalize_text(raw2)

    assert "reinforced concrete" in norm1.lower()
    assert "reinforced concrete" in norm2.lower()


def test_runtime_custom_mapping(normalizer):
    normalizer.add_mapping("tbm", "tunnel boring machine")
    raw = "TBM cutter head assembly ongoing"
    normalized = normalizer.normalize_text(raw)

    assert "tunnel boring machine" in normalized.lower()


def test_custom_json_glossary_loading():
    custom_glossary_data = {
        "abbreviations": {
            "wom": "works order management",
            "dbr": "design basis report"
        },
        "synonyms": {
            "muck removal": "spoil disposal excavation"
        }
    }

    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as f:
        json.dump(custom_glossary_data, f)
        temp_path = f.name

    try:
        norm = TerminologyNormalizer(glossary_path=temp_path)
        res = norm.normalize_text("WOM update for muck removal")
        assert "works order management" in res.lower()
        assert "spoil disposal excavation" in res.lower()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def test_discipline_tagging(normalizer):
    tags_civil = normalizer.get_discipline_tags("rebar cage and rcc pier pouring")
    assert "Civil" in tags_civil

    tags_elec = normalizer.get_discipline_tags("substatn electrical conduit laying")
    assert "Electrical" in tags_elec

    tags_struct = normalizer.get_discipline_tags("PSC girder erection")
    assert "Structural" in tags_struct

    tags_multi = normalizer.get_discipline_tags("rebar fixing for substation building")
    assert "Civil" in tags_multi
    assert "Electrical" in tags_multi


def test_normalize_with_context_tuple(normalizer):
    normalized, disciplines = normalizer.normalize_with_context("hvac ductwork and rebar")
    assert "Civil" in disciplines
    assert "Piping & Utilities" in disciplines
    assert "reinforcement" in normalized.lower()
    assert "heating ventilation" in normalized.lower()
