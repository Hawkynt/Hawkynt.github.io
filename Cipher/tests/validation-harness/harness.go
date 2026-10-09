// ---------------------------------------------------------------------------
// Vector harness appended to a transpiled Go algorithm by
// tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt
//
// The spec placeholder below is replaced by the harness spec of the reference run: the
// algorithms the file registers and, per vector, the fields to apply in
// TestEngine order and the checks the reference passed. Fields are applied with
// the semantics of TestEngine.ConfigureInstance (as tests/validation-harness/
// harness.js does): a setter method of the vector's setter name, else a
// property of the field's name; a field that reaches neither, or whose setter
// throws, fails the vector. Transpiled objects expose their JavaScript members
// by name through JsObject (JsGet/JsSet/JsCall/JsHas/JsHasMethod).
//
// Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
//                  @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
// ---------------------------------------------------------------------------

const vhSpecJSON = `__SPEC_JSON__`

type vhStep struct {
	Field  string
	Setter string
	Kind   string
	IsNull bool
}

type vhMode struct {
	Cipher    *string
	KeyTruthy bool
	IvTruthy  bool
}

type vhPlan struct {
	Fields  []string
	Steps   []vhStep
	Mode    *vhMode
	Inverse bool
	Expect  bool
	Rt      *string
}

type vhAlgorithm struct {
	Name      string
	ClassName string
	IsMode    bool
	MultiKey  bool
	Vectors   []vhPlan
}

var vhCipherNames = map[string]string{
	"AES": "Rijndael (AES)", "Rijndael": "Rijndael (AES)", "DES": "DES", "3DES": "3DES (Triple DES)",
	"Blowfish": "Blowfish", "Camellia": "Camellia", "ARIA": "ARIA",
}

func vhDefaultBytes() []uint8 {
	return []uint8{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
}

func vhOneLine(s string) string {
	return regexp.MustCompile(`\s*[\r\n]+\s*`).ReplaceAllString(s, " | ")
}

func vhDescribe(r any) string {
	switch x := r.(type) {
	case *JsError:
		if x.Value != nil && x.Name == "" {
			return "thrown: " + jsStr(x.Value)
		}
		name := x.Name
		if name == "" {
			name = "Error"
		}
		return name + ": " + x.Message
	case error:
		return "TypeError: " + x.Error()
	}
	return "thrown: " + fmt.Sprint(r)
}

// vhTry runs f and returns the description of what it threw, or "".
func vhTry(f func()) (failure string) {
	defer func() {
		if r := recover(); r != nil {
			failure = vhDescribe(r)
		}
	}()
	f()
	return ""
}

func vhList(v any) ([]any, bool) {
	if v == nil {
		return nil, false
	}
	rv := reflect.ValueOf(v)
	if rv.Kind() != reflect.Slice {
		return nil, false
	}
	out := make([]any, rv.Len())
	for i := range out {
		out[i] = rv.Index(i).Interface()
	}
	return out, true
}

func vhNumber(v any) (float64, bool) {
	switch v.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
		return jsF64(v), true
	}
	return 0, false
}

func vhSameBytes(a, b any) bool {
	la, oka := vhList(a)
	lb, okb := vhList(b)
	if !oka || !okb || len(la) != len(lb) {
		return false
	}
	for i := range la {
		x, okx := vhNumber(la[i])
		y, oky := vhNumber(lb[i])
		if !okx || !oky || x != y {
			return false
		}
	}
	return true
}

func vhHex(v any) string {
	list, ok := vhList(v)
	if !ok {
		if v == nil {
			return "undefined"
		}
		return jsStr(v)
	}
	var sb strings.Builder
	for _, item := range list {
		if n, ok := vhNumber(item); ok && n >= 0 && n < 256 && n == math.Trunc(n) {
			sb.WriteString(fmt.Sprintf("%02x", int(n)))
		} else {
			sb.WriteString("<" + jsStr(item) + ">")
		}
	}
	return sb.String()
}

// The identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher
type vhDummyAlgorithm struct{}

func (d *vhDummyAlgorithm) JsGet(name string) any {
	switch name {
	case "name":
		return "DummyBlockCipher"
	case "BlockSize":
		return int32(16)
	}
	return nil
}
func (d *vhDummyAlgorithm) JsSet(name string, value any) {}
func (d *vhDummyAlgorithm) JsCall(name string, args ...any) any {
	if name == "CreateInstance" {
		return vhNewDummy()
	}
	panic(jsNewError("TypeError", "algorithm."+name+" is not a function"))
}
func (d *vhDummyAlgorithm) JsHas(name string) bool       { return name == "name" || name == "BlockSize" || name == "CreateInstance" }
func (d *vhDummyAlgorithm) JsHasMethod(name string) bool { return name == "CreateInstance" }

type vhDummyCipher struct {
	key    []uint8
	buffer []uint8
	extra  map[string]any
}

func vhNewDummy() *vhDummyCipher { return &vhDummyCipher{} }

func (d *vhDummyCipher) JsGet(name string) any {
	switch name {
	case "algorithm":
		return &vhDummyAlgorithm{}
	case "BlockSize":
		return int32(16)
	case "isInverse":
		return false
	case "key":
		if d.key == nil {
			return nil
		}
		return jsCopy(d.key)
	case "_key":
		return d.key
	case "inputBuffer":
		return d.buffer
	}
	return d.extra[name]
}
func (d *vhDummyCipher) JsSet(name string, value any) {
	switch name {
	case "key":
		if jsTruthy(value) {
			d.key = jsTo[[]uint8](value)
		} else {
			d.key = nil
		}
		return
	case "inputBuffer":
		d.buffer = jsTo[[]uint8](value)
		return
	}
	if d.extra == nil {
		d.extra = map[string]any{}
	}
	d.extra[name] = value
}
func (d *vhDummyCipher) JsCall(name string, args ...any) any {
	switch name {
	case "Feed":
		data := jsTo[[]uint8](jsArg(args, 0))
		d.buffer = append(d.buffer, data...)
		return nil
	case "Result":
		if d.key == nil {
			panic(jsNewError("Error", "Key not set"))
		}
		out := []uint8{}
		for i := 0; i < len(d.buffer); i += 16 {
			for j := 0; j < 16; j++ {
				var b uint8
				if i+j < len(d.buffer) {
					b = d.buffer[i+j]
				}
				out = append(out, b^d.key[j%len(d.key)])
			}
		}
		d.buffer = nil
		return out
	}
	panic(jsNewError("TypeError", "cipher."+name+" is not a function"))
}
func (d *vhDummyCipher) JsHas(name string) bool {
	switch name {
	case "algorithm", "BlockSize", "isInverse", "key", "_key", "inputBuffer", "Feed", "Result":
		return true
	}
	_, ok := d.extra[name]
	return ok
}
func (d *vhDummyCipher) JsHasMethod(name string) bool { return name == "Feed" || name == "Result" }

/** The last registration of that name (bundled dependencies register first). */
func vhFind(name string) JsObject {
	for i := len(jsAlgorithms) - 1; i >= 0; i-- {
		if jsStr(jsAlgorithms[i].JsGet("name")) == name {
			return jsAlgorithms[i]
		}
	}
	return nil
}

func vhSetField(field string, apply func()) {
	if failure := vhTry(apply); failure != "" {
		panic(jsNewError("Error", "Setting vector field '"+field+"' failed: "+failure))
	}
}

// A setter method of that name, else a property of the field's name
func vhApply(instance JsObject, field, setter string, value any) bool {
	if setter != "" && instance.JsHasMethod(setter) {
		vhSetField(field, func() { instance.JsCall(setter, value) })
		return true
	}
	if instance.JsHas(field) {
		vhSetField(field, func() { instance.JsSet(field, value) })
		return true
	}
	return false
}

func vhContains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

func vhConfigure(spec vhAlgorithm, plan vhPlan, instance JsObject, vector JsObject) {
	applied := map[string]bool{}
	if spec.IsMode {
		mode := plan.Mode
		var cipher JsObject
		if mode != nil && mode.Cipher != nil {
			name := *mode.Cipher
			found := vhFind(name)
			if mapped, ok := vhCipherNames[name]; ok {
				if f := vhFind(mapped); f != nil {
					found = f
				}
			}
			if found != nil {
				cipher = jsToObject(found.JsCall("CreateInstance", false))
			}
			if cipher == nil {
				panic(jsNewError("Error", "Vector field 'cipher' is not applied: no block cipher named '"+name+"' is registered"))
			}
		} else {
			cipher = vhNewDummy()
		}
		if !spec.MultiKey {
			if mode != nil && mode.KeyTruthy {
				cipher.JsSet("key", vector.JsGet("key"))
			} else {
				cipher.JsSet("key", vhDefaultBytes())
			}
		}
		if vhContains(plan.Fields, "cipher") {
			applied["cipher"] = true
		}
		if vhContains(plan.Fields, "key") && !spec.MultiKey {
			applied["key"] = true
		}
		if instance.JsHasMethod("setBlockCipher") {
			instance.JsCall("setBlockCipher", cipher)
		}
		if instance.JsHasMethod("setIV") {
			if mode != nil && mode.IvTruthy {
				iv := vector.JsGet("iv")
				vhSetField("iv", func() { instance.JsCall("setIV", iv) })
				applied["iv"] = true
			} else {
				instance.JsCall("setIV", vhDefaultBytes())
			}
		}
	}

	for _, step := range plan.Steps {
		value := vector.JsGet(step.Field)
		if step.Kind == "kek" {
			asKek := vhApply(instance, "kek", "setKEK", value)
			asKey := !instance.JsHasMethod("setKEK") && instance.JsHasMethod("setKey") && vhApply(instance, "key", "setKey", value)
			if asKek || asKey {
				applied["kek"] = true
			}
		} else if vhApply(instance, step.Field, step.Setter, value) {
			applied[step.Field] = true
		}
	}

	for _, field := range plan.Fields {
		if !applied[field] {
			panic(jsNewError("Error", "Vector field '"+field+"' is not applied: "+spec.Name+" has no setter or property of that name"))
		}
	}
}

func vhRun(algorithm JsObject, spec vhAlgorithm, plan vhPlan, vector JsObject, inverse bool, input any) any {
	instance := jsToObject(algorithm.JsCall("CreateInstance", inverse))
	if instance == nil {
		panic(jsNewError("Error", fmt.Sprintf("Failed to create algorithm instance (inverse=%v)", inverse)))
	}
	vhConfigure(spec, plan, instance, vector)
	instance.JsCall("Feed", input)
	return instance.JsCall("Result")
}

func vhCheck(algorithm JsObject, spec vhAlgorithm, plan vhPlan, vector JsObject) (failure string) {
	defer func() {
		if r := recover(); r != nil {
			failure = vhDescribe(r)
			// VH_TRACE=1 shows where a vector failed (for working on the transpiler)
			if os.Getenv("VH_TRACE") != "" {
				fmt.Fprintln(os.Stderr, failure, string(debug.Stack()))
			}
		}
	}()
	input := vector.JsGet("input")
	output := vhRun(algorithm, spec, plan, vector, plan.Inverse, input)
	if plan.Expect && !vhSameBytes(output, vector.JsGet("expected")) {
		return "output " + vhHex(output) + " expected " + vhHex(vector.JsGet("expected"))
	}
	if plan.Rt != nil && *plan.Rt == "decode" {
		back := vhRun(algorithm, spec, plan, vector, !plan.Inverse, output)
		if !vhSameBytes(back, input) {
			return "round trip gave " + vhHex(back) + " expected the input " + vhHex(input)
		}
	} else if plan.Rt != nil && *plan.Rt == "stability" {
		decoded := vhRun(algorithm, spec, plan, vector, true, output)
		again := vhRun(algorithm, spec, plan, vector, false, decoded)
		if !vhSameBytes(again, output) {
			return "encoding is not stable: re-encoding gave " + vhHex(again) + " expected " + vhHex(output)
		}
	}
	return ""
}

func main() {
	var spec struct{ Algorithms []vhAlgorithm }
	if err := json.Unmarshal([]byte(vhSpecJSON), &spec); err != nil {
		fmt.Println("@@ALGO 0 MISSING the harness spec does not parse: " + err.Error())
		fmt.Println("@@DONE")
		return
	}
	for a, s := range spec.Algorithms {
		var algorithm JsObject
		if failure := vhTry(func() { algorithm = vhFind(s.Name) }); failure != "" {
			fmt.Printf("@@ALGO %d MISSING %s\n", a, vhOneLine(failure))
			continue
		}
		if algorithm == nil {
			fmt.Printf("@@ALGO %d MISSING no algorithm named '%s' is registered\n", a, vhOneLine(s.Name))
			continue
		}
		var tests []any
		if failure := vhTry(func() { tests, _ = vhList(algorithm.JsGet("tests")) }); failure != "" {
			fmt.Printf("@@ALGO %d MISSING reading its tests: %s\n", a, vhOneLine(failure))
			continue
		}
		if len(tests) != len(s.Vectors) {
			fmt.Printf("@@ALGO %d COUNT %d\n", a, len(tests))
		}
		for v, plan := range s.Vectors {
			failure := "vector missing"
			if v < len(tests) {
				vector, ok := tests[v].(JsObject)
				if !ok || jsIsNull(vector) {
					failure = "the vector is not an object"
				} else {
					failure = vhCheck(algorithm, s, plan, vector)
				}
			}
			if failure == "" {
				fmt.Printf("@@VEC %d %d PASS\n", a, v)
			} else {
				fmt.Printf("@@VEC %d %d FAIL %s\n", a, v, vhOneLine(failure))
			}
		}
	}
	fmt.Println("@@DONE")
}
