import os
import pytest
from dotenv import dotenv_values
from v2.setup_openai import save_settings


def test_save_preserves_other_settings_and_restricts_permissions(tmp_path):
    path = tmp_path / '.env'
    path.write_text('# company\nOTHER=keep\nOPENAI_API_KEY=old\n')
    save_settings(path, {'OPENAI_API_KEY':'sk-test-secret', 'COCKPIT_ACCESS_TOKEN':'company-code'})
    assert dotenv_values(path) == {'OTHER':'keep', 'OPENAI_API_KEY':'sk-test-secret', 'COCKPIT_ACCESS_TOKEN':'company-code'}
    assert '# company' in path.read_text()
    assert os.stat(path).st_mode & 0o777 == 0o600
    assert list(tmp_path.glob('.openai-config-*')) == []


def test_invalid_value_leaves_file_unchanged(tmp_path):
    path = tmp_path / '.env'
    path.write_text('OTHER=keep\n')
    with pytest.raises(ValueError):
        save_settings(path, {'OPENAI_API_KEY':"key\nINJECT=value"})
    assert path.read_text() == 'OTHER=keep\n'
