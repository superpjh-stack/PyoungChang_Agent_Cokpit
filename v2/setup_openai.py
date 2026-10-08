"""Run interactively on the server; secrets never enter browser storage or shell history."""
from getpass import getpass
from pathlib import Path
import os
import tempfile
from dotenv import dotenv_values


def save_settings(path, values):
    text = path.read_text() if path.exists() else ''
    lines = text.splitlines()
    for key, value in values.items():
        if any(char in value for char in "\r\n'\\"):
            raise ValueError('키와 접근 코드에는 줄바꿈, 따옴표, 역슬래시를 사용할 수 없습니다.')
        replacement = f"{key}='{value}'"
        matches = [i for i, line in enumerate(lines) if line.strip().startswith((key+'=', 'export '+key+'='))]
        if matches:
            for i in matches:
                lines[i] = replacement
        else:
            lines.append(replacement)
    fd, name = tempfile.mkstemp(prefix='.openai-config-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as output:
            output.write('\n'.join(lines)+'\n')
        os.chmod(name, 0o600)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def main():
    path = Path(__file__).resolve().parents[1] / '.env'
    existing = dotenv_values(path)
    print('평창꽃순이김치 OpenAI 설정 · 입력한 비밀값은 출력하지 않습니다.')
    key = getpass('OpenAI API 키 (기존 값 유지: Enter): ').strip()
    access = getpass('외부 접속용 회사 접근 코드 (기존 값 유지: Enter): ').strip()
    values = {}
    if key:
        if not key.startswith('sk-'):
            raise SystemExit('OpenAI API 키 형식을 확인하세요. 파일을 변경하지 않았습니다.')
        values['OPENAI_API_KEY'] = key
    elif not existing.get('OPENAI_API_KEY') and not os.getenv('OPENAI_API_KEY'):
        raise SystemExit('API 키가 없습니다. 파일을 변경하지 않았습니다.')
    if access:
        values['COCKPIT_ACCESS_TOKEN'] = access
    if values:
        save_settings(path, values)
    print('설정을 마쳤습니다. 서버를 다시 시작하고 화면에서 OpenAI 연결 검사를 눌러 주세요.')


if __name__ == '__main__':
    main()
