import pathlib

p = pathlib.Path('/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app.ts')
lines = p.read_text().split('\n')

# Find /runtime route and /public/demo/request route
sys_start = None
sys_end = None
pub_start = None
pub_end = None

for i, line in enumerate(lines):
    if sys_start is None and "app.get(path('/runtime')" in line:
        sys_start = i
    if sys_start is not None and "app.get(path('/public/blog/posts')" in line:
        sys_end = i
        pub_start = i
    if pub_start is not None and "app.post(path('/public/demo/request')" in line:
        pub_end = i
        break

print(f'System: lines {sys_start+1}-{sys_end} ({sys_end-sys_start} lines)')
print(f'Public: lines {pub_start+1}-{pub_end} ({pub_end-pub_start} lines)')

# Replace system block
sys_replacement = [
    '  registerSystemRoutes(app, path, { runtimeInfo: deps.runtimeInfo });',
    '',
]

# Replace public block
pub_replacement = [
    '  registerPublicRoutes(app, path, {',
    '    blogPostsRepository: deps.blogPostsRepository,',
    '    contactRequestsRepository: deps.contactRequestsRepository,',
    '    emailService: deps.emailService,',
    '  });',
    '',
]

new_lines = lines[:sys_start] + sys_replacement + pub_replacement + lines[pub_end:]
p.write_text('\n'.join(new_lines))
print(f'New file: {len(new_lines)} lines')
