
# ---------------------------------------------------------------------------
# Vector harness appended to a transpiled Python algorithm by
# tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt
#
# The spec placeholder below is replaced by the harness spec of the reference run: the
# algorithms the file registers and, per vector, the fields to apply in
# TestEngine order and the checks the reference passed. Fields are applied with
# the semantics of TestEngine.ConfigureInstance: a field that reaches no setter
# or property, or whose setter raises, fails the vector. JavaScript names are
# looked up as the transpiler writes them (snake_case), then verbatim.
#
# Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
#                  @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
# ---------------------------------------------------------------------------
import json as _vh_json
import re as _vh_re

_VH_SPEC = _vh_json.loads(__SPEC_JSON__)
_VH_DEFAULT_BYTES = list(range(16))
_VH_CIPHER_NAMES = {"AES": "Rijndael (AES)", "Rijndael": "Rijndael (AES)", "DES": "DES",
                    "3DES": "3DES (Triple DES)", "Blowfish": "Blowfish", "Camellia": "Camellia", "ARIA": "ARIA"}
_VH_MISSING = object()


def _vh_line(text):
    return _vh_re.sub(r"\s*[\r\n]+\s*", " | ", str(text))


def _vh_describe(e):
    return type(e).__name__ + ": " + str(e)


def _vh_snake(name):
    """The transpiler's snake_case of a JavaScript property name."""
    if len(name) == 1 and name == name.upper():
        return name
    if name == name.upper():
        return name
    s = _vh_re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
    s = _vh_re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s)
    return s.lower()


def _vh_names(name):
    out = []
    for n in (_vh_snake(name), _vh_snake(name) + "_", name):
        if n not in out:
            out.append(n)
    return out


def _vh_has_attr(obj, name):
    # Without calling a property getter, which may raise for an unset value
    try:
        if name in object.__getattribute__(obj, "__dict__"):
            return True
    except AttributeError:
        pass
    return any(name in vars(klass) for klass in type(obj).__mro__)


def _vh_method(obj, name):
    for n in _vh_names(name):
        if any(callable(vars(klass).get(n)) for klass in type(obj).__mro__):
            return getattr(obj, n)
    return None


def _vh_property(obj, name):
    for n in _vh_names(name):
        if _vh_has_attr(obj, n):
            return n
    return None


def _vh_value(v):
    if isinstance(v, (bytes, bytearray)):
        return list(v)
    return v


def _vh_field(vector, name):
    """A vector field's value: the transpiled vector keeps JavaScript names or snake_cases them."""
    for n in [name] + _vh_names(name):
        try:
            if isinstance(vector, dict):
                if n in vector:
                    return _vh_value(vector[n])
                continue
            d = object.__getattribute__(vector, "__dict__")
            if n in d:
                return _vh_value(getattr(vector, n))
        except AttributeError:
            pass
        if _vh_has_attr(vector, n):
            return _vh_value(getattr(vector, n))
    return _VH_MISSING


def _vh_list(v):
    if v is None:
        return None
    if isinstance(v, (bytes, bytearray)):
        return list(v)
    try:
        return list(v)
    except TypeError:
        return v


def _vh_same(a, b):
    a = _vh_list(a)
    b = _vh_list(b)
    if not isinstance(a, list) or not isinstance(b, list) or len(a) != len(b):
        return False
    return all(type(x) is not bool and type(y) is not bool and x == y for x, y in zip(a, b))


def _vh_hex(v):
    v = _vh_list(v)
    if not isinstance(v, list):
        return repr(v)
    return "".join(("%02x" % b) if isinstance(b, int) and 0 <= b < 256 else "<%r>" % (b,) for b in v)


def _vh_registry():
    found = []
    try:
        found.extend(_algorithms_by_name.values())
    except NameError:
        pass
    for v in list(globals().values()):
        if hasattr(type(v), "create_instance") and not isinstance(v, type) and v not in found:
            found.append(v)
    return found


def _vh_find(name):
    hits = [a for a in _vh_registry() if getattr(a, "name", None) == name]
    return hits[-1] if hits else None


class _VhDummyAlgorithm:
    def __init__(self):
        self.name = "DummyBlockCipher"
        self.block_size = 16
        self.BlockSize = 16

    def create_instance(self, is_inverse=False, *_):
        return _VhDummyInstance(self)


class _VhDummyInstance:
    """The identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher."""

    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.block_size = 16
        self.BlockSize = 16
        self.is_inverse = False
        self._key = None
        self.input_buffer = []

    @property
    def key(self):
        return list(self._key) if self._key else None

    @key.setter
    def key(self, value):
        self._key = list(value) if value else None

    def feed(self, data):
        if data:
            self.input_buffer.extend(data)

    def result(self):
        if not self._key:
            raise Exception("Key not set")
        out = []
        for i in range(0, len(self.input_buffer), 16):
            block = list(self.input_buffer[i:i + 16])
            while len(block) < 16:
                block.append(0)
            for j in range(16):
                out.append(block[j] ^ self._key[j % len(self._key)])
        self.input_buffer = []
        return out


def _vh_set_field(field, apply):
    try:
        apply()
    except Exception as e:
        raise Exception("Setting vector field '%s' failed: %s" % (field, _vh_describe(e)))


def _vh_apply(instance, field, setter, value):
    if setter:
        method = _vh_method(instance, setter)
        if method is not None:
            _vh_set_field(field, lambda: method(value))
            return True
    prop = _vh_property(instance, field)
    if prop is not None:
        _vh_set_field(field, lambda: setattr(instance, prop, value))
        return True
    return False


def _vh_configure(spec, plan, instance, vector):
    applied = set()
    if spec["isMode"]:
        mode = plan["mode"]
        if mode["cipher"] is not None:
            found = _vh_find(_VH_CIPHER_NAMES.get(mode["cipher"], mode["cipher"])) or _vh_find(mode["cipher"])
            cipher = found.create_instance(False) if found is not None else None
            if cipher is None:
                raise Exception("Vector field 'cipher' is not applied: no block cipher named '%s' is registered" % mode["cipher"])
        else:
            cipher = _VhDummyInstance(_VhDummyAlgorithm())
        if not spec["multiKey"]:
            cipher.key = _vh_field(vector, "key") if mode["keyTruthy"] else list(_VH_DEFAULT_BYTES)
        if "cipher" in plan["fields"]:
            applied.add("cipher")
        if "key" in plan["fields"] and not spec["multiKey"]:
            applied.add("key")
        set_block_cipher = _vh_method(instance, "setBlockCipher")
        if set_block_cipher is not None:
            set_block_cipher(cipher)
        set_iv = _vh_method(instance, "setIV")
        if set_iv is not None:
            if mode["ivTruthy"]:
                iv = _vh_field(vector, "iv")
                _vh_set_field("iv", lambda: set_iv(iv))
                applied.add("iv")
            else:
                set_iv(list(_VH_DEFAULT_BYTES))

    for step in plan["steps"]:
        value = _vh_field(vector, step["field"])
        if value is _VH_MISSING:
            raise Exception("Vector field '%s' is missing from the transpiled vector" % step["field"])
        if step.get("kind") == "kek":
            as_kek = _vh_apply(instance, "kek", "setKEK", value)
            as_key = _vh_method(instance, "setKEK") is None and _vh_method(instance, "setKey") is not None \
                and _vh_apply(instance, "key", "setKey", value)
            if as_kek or as_key:
                applied.add("kek")
        elif _vh_apply(instance, step["field"], step.get("setter"), value):
            applied.add(step["field"])

    for field in plan["fields"]:
        if field not in applied:
            raise Exception("Vector field '%s' is not applied: %s has no setter or property of that name" % (field, spec["name"]))


def _vh_run(algorithm, spec, plan, vector, inverse, data):
    instance = algorithm.create_instance(inverse)
    if instance is None:
        raise Exception("Failed to create algorithm instance (inverse=%s)" % inverse)
    _vh_configure(spec, plan, instance, vector)
    instance.feed(data)
    return _vh_list(instance.result())


def _vh_check(algorithm, spec, plan, vector):
    data = _vh_field(vector, "input")
    data = None if data is _VH_MISSING else data
    output = _vh_run(algorithm, spec, plan, vector, plan["inverse"], data)
    if plan["expect"]:
        expected = _vh_field(vector, "expected")
        if not _vh_same(output, expected):
            return "output %s expected %s" % (_vh_hex(output), _vh_hex(expected))
    if plan["rt"] == "decode":
        back = _vh_run(algorithm, spec, plan, vector, not plan["inverse"], output)
        if not _vh_same(back, data):
            return "round trip gave %s expected the input %s" % (_vh_hex(back), _vh_hex(data))
    elif plan["rt"] == "stability":
        decoded = _vh_run(algorithm, spec, plan, vector, True, output)
        again = _vh_run(algorithm, spec, plan, vector, False, decoded)
        if not _vh_same(again, output):
            return "encoding is not stable: re-encoding gave %s expected %s" % (_vh_hex(again), _vh_hex(output))
    return None


def _vh_main():
    for a, spec in enumerate(_VH_SPEC["algorithms"]):
        try:
            algorithm = _vh_find(spec["name"])
        except Exception as e:
            print("@@ALGO %d MISSING %s" % (a, _vh_line(_vh_describe(e))), flush=True)
            continue
        if algorithm is None:
            print("@@ALGO %d MISSING no algorithm named '%s' is registered" % (a, _vh_line(spec["name"])), flush=True)
            continue
        tests = list(getattr(algorithm, "tests", None) or [])
        if len(tests) != len(spec["vectors"]):
            print("@@ALGO %d COUNT %d" % (a, len(tests)), flush=True)
        for v, plan in enumerate(spec["vectors"]):
            try:
                failure = _vh_check(algorithm, spec, plan, tests[v]) if v < len(tests) else "vector missing"
            except Exception as e:
                failure = _vh_describe(e)
            print("@@VEC %d %d %s" % (a, v, "PASS" if failure is None else "FAIL " + _vh_line(failure)), flush=True)
    print("@@DONE", flush=True)


if __name__ == "__main__":
    _vh_main()
