import pathlib
p = pathlib.Path('/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app.ts')
lines = p.read_text().split('\n')
csp_start = None
csp_end = None
for i, line in enumerate(lines):
    if "'Content-Security-Policy'" in line and csp_start is None:
        csp_start = i - 1
    if csp_start is not None and "].join('; ')" in line and i > csp_start:
        csp_end = i
        break
csp_block = [
    "    c.header(",
    "      'Content-Security-Policy',",
    "      [",
    '        "default-src \'self\'",',
    '        "script-src \'self\' \'unsafe-inline\' https://cdn.paddle.com",',
    '        "style-src \'self\' \'unsafe-inline\'",',
    '        "img-src \'self\' data: https:",',
    '        "media-src \'self\' https://*.r2.cloudflarestorage.com",',
    '        "font-src \'self\'",',
    '        [',
    '          "connect-src \'self\'",',
    "          'https://*.supabase.co',",
    "          'https://api.telnyx.com',",
    "          'https://api.openai.com',",
    "          'wss://*.telnyx.com',",
    "          'wss://*.openai.com',",
    "          'https://api.resend.com',",
    "          'https://api.paddle.com',",
    "          'https://sandbox-api.paddle.com',",
    "          'https://*.paddle.com',",
    "        ].join(' '),",
    '        "frame-src \'self\' https://*.paddle.com",',
    '        "frame-ancestors \'none\'",',
    '        "base-uri \'self\'",',
    '        "form-action \'self\' https://*.paddle.com",',
    "      ].join('; '),",
    "    );",
]
new_lines = lines[:csp_start] + csp_block + lines[csp_end+1:]
p.write_text('\n'.join(new_lines))
print(f'Fixed. {len(new_lines)} lines')
