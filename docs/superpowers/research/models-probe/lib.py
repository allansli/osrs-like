import io
class Doc:
    def __init__(self, path):
        self.path = path; self.t = io.open(path, encoding='utf-8').read()
    def sub(self, old, new, count=1):
        n = self.t.count(old)
        assert n == count, f"expected {count} of {old[:70]!r}, found {n}"
        self.t = self.t.replace(old, new)
    def between(self, start, end, new):
        assert self.t.count(start) == 1, f"start {start[:60]!r} x{self.t.count(start)}"
        a = self.t.index(start); b = self.t.index(end, a + len(start))
        self.t = self.t[:a] + new.rstrip('\n') + '\n\n' + self.t[b:]
    def before(self, marker, new):
        assert self.t.count(marker) == 1, f"marker {marker[:60]!r} x{self.t.count(marker)}"
        a = self.t.index(marker); self.t = self.t[:a] + new.rstrip('\n') + '\n\n' + self.t[a:]
    def save(self):
        io.open(self.path, 'w', encoding='utf-8').write(self.t)
