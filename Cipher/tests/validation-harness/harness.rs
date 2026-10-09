// ---------------------------------------------------------------------------
// Vector harness appended to a transpiled Rust algorithm by
// tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt
//
// The placeholders below are replaced when the harness is generated: the spec
// of the reference run as Rust values (the algorithms the file registers and,
// per vector, the fields to apply in TestEngine order and the checks the
// reference passed), and the module initializers of the bundled files
// (dependencies first, so they register first). Fields are applied with the
// semantics of TestEngine.ConfigureInstance (as tests/validation-harness/
// harness.js does): a setter method of the vector's setter name, else a
// property of the field's name; a field that reaches neither, or whose setter
// throws, fails the vector. Transpiled objects expose their JavaScript members
// by name through the JsObject trait.
//
// Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
//                  @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
// ---------------------------------------------------------------------------

struct VhStep {
    field: &'static str,
    setter: &'static str,
    kind: &'static str,
}

struct VhMode {
    cipher: Option<&'static str>,
    key_truthy: bool,
    iv_truthy: bool,
}

struct VhPlan {
    fields: Vec<&'static str>,
    steps: Vec<VhStep>,
    mode: Option<VhMode>,
    inverse: bool,
    expect: bool,
    rt: &'static str,
}

struct VhAlgorithm {
    name: &'static str,
    is_mode: bool,
    multi_key: bool,
    vectors: Vec<VhPlan>,
}

fn vh_spec() -> Vec<VhAlgorithm> {
    __SPEC__
}

fn vh_one_line(s: &str) -> String {
    s.split(|c| c == '\r' || c == '\n').map(|l| l.trim()).filter(|l| !l.is_empty()).collect::<Vec<_>>().join(" | ")
}

fn vh_describe(e: &JsAny) -> String {
    if let Some(err) = e.downcast::<JsError>() {
        let name = if err.name.is_empty() { "Error".to_string() } else { err.name.clone() };
        return format!("{}: {}", name, err.message);
    }
    format!("thrown: {}", e.text())
}

/// Runs f; what it threw, described, or None
fn vh_try<R>(f: impl FnOnce() -> R) -> Result<R, String> {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)) {
        Ok(r) => Ok(r),
        Err(p) => Err(vh_describe(&js_caught(p))),
    }
}

fn vh_default_bytes() -> JsAny { js_arr::<u8>((0u8..16).collect()).to_js() }

fn vh_same_bytes(a: &JsAny, b: &JsAny) -> bool {
    match (a.list(), b.list()) {
        (Some(x), Some(y)) => x.len() == y.len() && x.iter().zip(y.iter()).all(|(p, q)| p.type_of() == "number" && q.type_of() == "number" && p.num() == q.num()),
        _ => false,
    }
}

fn vh_hex(v: &JsAny) -> String {
    match v.list() {
        None => v.text(),
        Some(items) => items.iter().map(|x| {
            let n = x.num();
            if x.type_of() == "number" && n >= 0.0 && n < 256.0 && n.fract() == 0.0 { format!("{:02x}", n as u32) } else { format!("<{}>", x.text()) }
        }).collect(),
    }
}

/// The identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher
#[derive(Clone, Default)]
struct VhDummyCipher(Rc<RefCell<(Option<Vec<u8>>, Vec<u8>, HashMap<String, JsAny>)>>);

impl JsObject for VhDummyCipher {
    fn as_any(&self) -> &dyn Any { self }
    fn js_get(&self, name: &str) -> JsAny {
        match name {
            "algorithm" => js_obj_of(vec![("name", "DummyBlockCipher".to_string().to_js()), ("BlockSize", 16i32.to_js())]).to_js(),
            "BlockSize" => 16i32.to_js(),
            "isInverse" => false.to_js(),
            "key" => match &self.0.borrow().0 { Some(k) => js_arr(k.clone()).to_js(), None => JsAny::undefined() },
            _ => self.0.borrow().2.get(name).cloned().unwrap_or_default(),
        }
    }
    fn js_set(&self, name: &str, value: JsAny) {
        if name == "key" {
            self.0.borrow_mut().0 = if value.truthy() { Some(<JsArr<u8>>::from_js(&value).to_vec()) } else { None };
            return;
        }
        self.0.borrow_mut().2.insert(name.to_string(), value);
    }
    fn js_call(&self, name: &str, args: Vec<JsAny>) -> JsAny {
        match name {
            "Feed" => {
                let data = <JsArr<u8>>::from_js(&js_arg(&args, 0));
                if !data.is_null() { self.0.borrow_mut().1.extend(data.to_vec()); }
                JsAny::undefined()
            }
            "Result" => {
                let key = match self.0.borrow().0.clone() { Some(k) if !k.is_empty() => k, _ => js_throw_error("Error", "Key not set") };
                let buffer = std::mem::take(&mut self.0.borrow_mut().1);
                let mut out = Vec::new();
                let mut i = 0;
                while i < buffer.len() {
                    for j in 0..16 { out.push(buffer.get(i + j).cloned().unwrap_or(0) ^ key[j % key.len()]); }
                    i += 16;
                }
                js_arr(out).to_js()
            }
            _ => js_throw_error("TypeError", &format!("cipher.{} is not a function", name)),
        }
    }
    fn js_has(&self, name: &str) -> bool { matches!(name, "algorithm" | "BlockSize" | "isInverse" | "key" | "Feed" | "Result") || self.0.borrow().2.contains_key(name) }
    fn js_has_method(&self, name: &str) -> bool { name == "Feed" || name == "Result" }
}

fn vh_find(name: &str) -> JsObj {
    let all = JS_ALGORITHMS.with(|r| r.borrow().clone());
    for a in all.iter().rev() {
        if a.get("name").text() == name { return a.clone(); }
    }
    JsObj::null()
}

fn vh_set_field(field: &str, apply: impl FnOnce()) {
    if let Err(failure) = vh_try(apply) {
        js_throw_error("Error", &format!("Setting vector field '{}' failed: {}", field, failure));
    }
}

/// A setter method of that name, else a property of the field's name
fn vh_apply(instance: &JsObj, field: &str, setter: &str, value: JsAny) -> bool {
    if !setter.is_empty() && instance.has_method(setter) {
        vh_set_field(field, || { instance.call(setter, vec![value]); });
        return true;
    }
    if instance.has(field) {
        vh_set_field(field, || instance.set(field, value));
        return true;
    }
    false
}

fn vh_configure(spec: &VhAlgorithm, plan: &VhPlan, instance: &JsObj, vector: &JsObj) {
    let mut applied: Vec<&str> = Vec::new();
    if spec.is_mode {
        let mode = plan.mode.as_ref();
        let cipher: JsObj = match mode.and_then(|m| m.cipher) {
            Some(name) => {
                let mapped = match name { "AES" | "Rijndael" => "Rijndael (AES)", "3DES" => "3DES (Triple DES)", other => other };
                let mut found = vh_find(mapped);
                if found.is_null() { found = vh_find(name); }
                let c = if found.is_null() { JsObj::null() } else { found.call("CreateInstance", vec![false.to_js()]).obj() };
                if c.is_null() { js_throw_error("Error", &format!("Vector field 'cipher' is not applied: no block cipher named '{}' is registered", name)); }
                c
            }
            None => JsObj::new(VhDummyCipher::default()),
        };
        if !spec.multi_key {
            let key = if mode.map(|m| m.key_truthy).unwrap_or(false) { vector.get("key") } else { vh_default_bytes() };
            cipher.set("key", key);
        }
        if plan.fields.contains(&"cipher") { applied.push("cipher"); }
        if plan.fields.contains(&"key") && !spec.multi_key { applied.push("key"); }
        if instance.has_method("setBlockCipher") { instance.call("setBlockCipher", vec![cipher.to_js()]); }
        if instance.has_method("setIV") {
            if mode.map(|m| m.iv_truthy).unwrap_or(false) {
                let iv = vector.get("iv");
                vh_set_field("iv", || { instance.call("setIV", vec![iv]); });
                applied.push("iv");
            } else {
                instance.call("setIV", vec![vh_default_bytes()]);
            }
        }
    }
    for step in &plan.steps {
        let value = vector.get(step.field);
        if step.kind == "kek" {
            let as_kek = vh_apply(instance, "kek", "setKEK", value.clone());
            let as_key = !instance.has_method("setKEK") && instance.has_method("setKey") && vh_apply(instance, "key", "setKey", value);
            if as_kek || as_key { applied.push("kek"); }
        } else if vh_apply(instance, step.field, step.setter, value) {
            applied.push(step.field);
        }
    }
    for field in &plan.fields {
        if !applied.contains(field) {
            js_throw_error("Error", &format!("Vector field '{}' is not applied: {} has no setter or property of that name", field, spec.name));
        }
    }
}

fn vh_run(algorithm: &JsObj, spec: &VhAlgorithm, plan: &VhPlan, vector: &JsObj, inverse: bool, input: JsAny) -> JsAny {
    let instance = algorithm.call("CreateInstance", vec![inverse.to_js()]).obj();
    if instance.is_null() { js_throw_error("Error", &format!("Failed to create algorithm instance (inverse={})", inverse)); }
    vh_configure(spec, plan, &instance, vector);
    instance.call("Feed", vec![input]);
    instance.call("Result", vec![])
}

fn vh_check(algorithm: &JsObj, spec: &VhAlgorithm, plan: &VhPlan, vector: &JsObj) -> Option<String> {
    let input = vector.get("input");
    let output = vh_run(algorithm, spec, plan, vector, plan.inverse, input.clone());
    if plan.expect && !vh_same_bytes(&output, &vector.get("expected")) {
        return Some(format!("output {} expected {}", vh_hex(&output), vh_hex(&vector.get("expected"))));
    }
    if plan.rt == "decode" {
        let back = vh_run(algorithm, spec, plan, vector, !plan.inverse, output);
        if !vh_same_bytes(&back, &input) { return Some(format!("round trip gave {} expected the input {}", vh_hex(&back), vh_hex(&input))); }
    } else if plan.rt == "stability" {
        let decoded = vh_run(algorithm, spec, plan, vector, true, output.clone());
        let again = vh_run(algorithm, spec, plan, vector, false, decoded);
        if !vh_same_bytes(&again, &output) { return Some(format!("encoding is not stable: re-encoding gave {} expected {}", vh_hex(&again), vh_hex(&output))); }
    }
    None
}

fn main() {
    std::panic::set_hook(Box::new(|_| {}));
    // A deep recursion of the transpiled code needs more stack than the main thread's
    let worker = std::thread::Builder::new().stack_size(256 * 1024 * 1024).spawn(vh_main).unwrap();
    let _ = worker.join();
    println!("@@DONE");
}

fn vh_main() {
    if let Err(failure) = vh_try(|| { __MODULE_INITS__ }) {
        println!("@@ALGO 0 MISSING loading the module failed: {}", vh_one_line(&failure));
    }
    for (a, spec) in vh_spec().iter().enumerate() {
        let algorithm = match vh_try(|| vh_find(spec.name)) {
            Ok(x) => x,
            Err(f) => { println!("@@ALGO {} MISSING {}", a, vh_one_line(&f)); continue; }
        };
        if algorithm.is_null() {
            println!("@@ALGO {} MISSING no algorithm named '{}' is registered", a, vh_one_line(spec.name));
            continue;
        }
        let tests = match vh_try(|| algorithm.get("tests").list().unwrap_or_default()) {
            Ok(t) => t,
            Err(f) => { println!("@@ALGO {} MISSING reading its tests: {}", a, vh_one_line(&f)); continue; }
        };
        if tests.len() != spec.vectors.len() { println!("@@ALGO {} COUNT {}", a, tests.len()); }
        for (v, plan) in spec.vectors.iter().enumerate() {
            let failure = if v < tests.len() {
                let vector = tests[v].obj();
                if vector.is_null() { Some("the vector is not an object".to_string()) } else {
                    match vh_try(|| vh_check(&algorithm, spec, plan, &vector)) { Ok(r) => r, Err(f) => Some(f) }
                }
            } else { Some("vector missing".to_string()) };
            match failure {
                None => println!("@@VEC {} {} PASS", a, v),
                Some(f) => println!("@@VEC {} {} FAIL {}", a, v, vh_one_line(&f)),
            }
        }
    }
}
