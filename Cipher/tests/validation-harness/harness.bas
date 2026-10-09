' ---------------------------------------------------------------------------
' Vector harness appended to a transpiled FreeBASIC algorithm by
' tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt
'
' The spec text below is replaced by the harness spec of the reference run, as
' JSON: the algorithms the file registers and, per vector, the fields to apply
' in TestEngine order and the checks the reference passed. Fields are applied
' with the semantics of TestEngine.ConfigureInstance: a field that reaches no
' setter or property, or whose setter throws, fails the vector. The transpiled
' code runs on the JavaScript-semantics runtime (BasicTransformer.js), so the
' harness drives it through that runtime: names are symbols, failures are
' thrown values caught with setjmp.
'
' Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
'                  @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
' ---------------------------------------------------------------------------

Dim Shared vh_spec_text As String
__SPEC_TEXT__

' ---- a JSON reader onto runtime values ----
Dim Shared vh_json_pos As Long

Declare Function vh_json_value(ByRef s As String) As JsV

Sub vh_json_ws(ByRef s As String)
  Do While vh_json_pos < Len(s)
    Dim c As Long = s[vh_json_pos]
    If c <> 32 AndAlso c <> 9 AndAlso c <> 10 AndAlso c <> 13 Then Exit Do
    vh_json_pos += 1
  Loop
End Sub

Function vh_json_string(ByRef s As String) As String
  Dim r As String
  vh_json_pos += 1
  Do While vh_json_pos < Len(s)
    Dim c As Long = s[vh_json_pos]
    If c = 34 Then
      vh_json_pos += 1
      Exit Do
    End If
    If c = 92 Then
      vh_json_pos += 1
      Dim e As Long = s[vh_json_pos]
      Select Case e
        Case 110
          r &= Chr(10)
        Case 116
          r &= Chr(9)
        Case 114
          r &= Chr(13)
        Case 117
          Dim cp As Long = ValInt("&H" & Mid(s, vh_json_pos + 2, 4))
          r &= Chr(IIf(cp < 256, cp, 63))
          vh_json_pos += 4
        Case Else
          r &= Chr(e)
      End Select
    Else
      r &= Chr(c)
    End If
    vh_json_pos += 1
  Loop
  Return r
End Function

Function vh_json_value(ByRef s As String) As JsV
  vh_json_ws(s)
  Dim c As Long = s[vh_json_pos]
  If c = 123 Then
    Dim o As JsV = js_obj_new()
    vh_json_pos += 1
    vh_json_ws(s)
    If s[vh_json_pos] = 125 Then
      vh_json_pos += 1
      Return o
    End If
    Do
      vh_json_ws(s)
      Dim k As String = vh_json_string(s)
      vh_json_ws(s)
      vh_json_pos += 1
      Dim v As JsV = vh_json_value(s)
      js_setp(o, js_sym(k), v)
      vh_json_ws(s)
      If s[vh_json_pos] = 44 Then
        vh_json_pos += 1
      Else
        vh_json_pos += 1
        Exit Do
      End If
    Loop
    Return o
  ElseIf c = 91 Then
    Dim a As JsV = js_arr_new(0)
    vh_json_pos += 1
    vh_json_ws(s)
    If s[vh_json_pos] = 93 Then
      vh_json_pos += 1
      Return a
    End If
    Do
      Dim v As JsV = vh_json_value(s)
      js_push1(a, v)
      vh_json_ws(s)
      If s[vh_json_pos] = 44 Then
        vh_json_pos += 1
      Else
        vh_json_pos += 1
        Exit Do
      End If
    Loop
    Return a
  ElseIf c = 34 Then
    Return js_str(vh_json_string(s))
  ElseIf c = 116 Then
    vh_json_pos += 4
    Return js_bool(-1)
  ElseIf c = 102 Then
    vh_json_pos += 5
    Return js_bool(0)
  ElseIf c = 110 Then
    vh_json_pos += 4
    Return js_null()
  End If
  Dim st As Long = vh_json_pos
  Do While vh_json_pos < Len(s)
    Dim d As Long = s[vh_json_pos]
    If (d >= 48 AndAlso d <= 57) OrElse d = 45 OrElse d = 43 OrElse d = 46 OrElse d = 101 OrElse d = 69 Then
      vh_json_pos += 1
    Else
      Exit Do
    End If
  Loop
  Return js_num(Val(Mid(s, st + 1, vh_json_pos - st)))
End Function

' ---- helpers ----
Function vh_get(ByRef o As JsV, ByRef nm As String) As JsV
  Return js_getp(o, js_sym(nm))
End Function

Function vh_line(ByRef t As String) As String
  Dim r As String
  For i As Long = 0 To Len(t) - 1
    If t[i] = 10 OrElse t[i] = 13 Then
      r &= " | "
    Else
      r &= Chr(t[i])
    End If
  Next
  Return r
End Function

Function vh_describe(ByRef e As JsV) As String
  If e.tag = JS_T_OBJ AndAlso e.p->kind = JS_K_OBJ Then
    Dim m As JsV = js_getp(e, SYM_message)
    Dim nm As JsV = js_getp(e, SYM_name)
    If m.tag <> JS_T_UNDEF Then Return IIf(nm.tag = JS_T_STR, JSS(nm), "Error") & ": " & js_tostring(m)
  End If
  Return "thrown: " & js_tostring(e)
End Function

Function vh_find(ByRef nm As String) As JsV
  Dim a As JsArrH Ptr = Cast(JsArrH Ptr, G_Algorithms.p)
  For i As Long = a->length - 1 To 0 Step -1
    Dim n As JsV = js_getp(a->items[i], SYM_name)
    If n.tag = JS_T_STR AndAlso JSS(n) = nm Then Return a->items[i]
  Next
  Return js_undefined()
End Function

Function vh_same(ByRef a As JsV, ByRef b As JsV) As Long
  If a.tag <> JS_T_OBJ OrElse b.tag <> JS_T_OBJ Then Return 0
  If a.p->kind <> JS_K_ARR AndAlso a.p->kind <> JS_K_TYPED Then Return 0
  If b.p->kind <> JS_K_ARR AndAlso b.p->kind <> JS_K_TYPED Then Return 0
  Dim n As Long = js_length(a)
  If n <> js_length(b) Then Return 0
  For i As Long = 0 To n - 1
    Dim x As JsV = js_index_get(a, i)
    Dim y As JsV = js_index_get(b, i)
    If x.tag <> JS_T_NUM OrElse y.tag <> JS_T_NUM OrElse x.n <> y.n Then Return 0
  Next
  Return -1
End Function

Function vh_hex(ByRef v As JsV) As String
  If v.tag <> JS_T_OBJ OrElse (v.p->kind <> JS_K_ARR AndAlso v.p->kind <> JS_K_TYPED) Then Return js_tostring(v)
  Dim s As String
  For i As Long = 0 To js_length(v) - 1
    Dim x As JsV = js_index_get(v, i)
    If x.tag = JS_T_NUM AndAlso x.n >= 0 AndAlso x.n < 256 AndAlso x.n = Int(x.n) Then
      s &= LCase(Right("0" & Hex(CLng(x.n)), 2))
    Else
      s &= "<" & js_tostring(x) & ">"
    End If
  Next
  Return s
End Function

' a vector field: undefined marks one the transpiled vector lacks
Function vh_has_field(ByRef vec As JsV, ByRef nm As String) As Long
  Return js_hasp(vec, js_sym(nm))
End Function

Function vh_field(ByRef vec As JsV, ByRef nm As String) As JsV
  Dim v As JsV = js_getp(vec, js_sym(nm))
  If v.tag = JS_T_OBJ AndAlso v.p->kind = JS_K_TYPED Then Return js_toarr(v)
  Return v
End Function

Dim Shared vh_failure As String

' call a setter or store a property; a throw is reported as the field's failure
Function vh_set(ByRef inst As JsV, ByRef fld As String, ByRef setter As String, ByRef value As JsV) As Long
  Dim useSetter As Long = Len(setter) > 0 AndAlso js_has_method(inst, js_sym(setter))
  If useSetter = 0 AndAlso js_hasp(inst, js_sym(fld)) = 0 Then Return 0
  js_jmp_top += 1
  If setjmp(@js_jmp(js_jmp_top)) = 0 Then
    If useSetter Then
      js_mcall1(inst, js_sym(setter), value)
    Else
      js_setp(inst, js_sym(fld), value)
    End If
    js_jmp_top -= 1
  Else
    js_jmp_top -= 1
    js_throw_error("Setting vector field '" & fld & "' failed: " & vh_describe(js_thrown))
  End If
  Return -1
End Function

' ---- the identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher ----
Dim Shared CLS_VhDummy As JsV

Function vh_dummy_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr) As JsV
  js_setp(self, SYM_BlockSize, js_num(16))
  js_setp(self, SYM_inputBuffer, js_arr_new(0))
  js_setp(self, SYM__key, js_null())
  Return self
End Function

Function vh_dummy_getkey(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr) As JsV
  Return js_getp(self, SYM__key)
End Function

Function vh_dummy_setkey(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr) As JsV
  Dim k As JsV = js_arg(argv, argc, 0)
  If js_truthy(k) AndAlso js_length(k) > 0 Then
    js_setp(self, SYM__key, js_slice_arr(k, js_undefined(), js_undefined()))
  Else
    js_setp(self, SYM__key, js_null())
  End If
  Return js_undefined()
End Function

Function vh_dummy_feed(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr) As JsV
  Dim d As JsV = js_arg(argv, argc, 0)
  If js_truthy(d) Then js_spread_into(js_getp(self, SYM_inputBuffer), d)
  Return js_undefined()
End Function

Function vh_dummy_result(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr) As JsV
  Dim k As JsV = js_getp(self, SYM__key)
  If js_truthy(k) = 0 Then js_throw_error("Key not set")
  Dim buf As JsV = js_getp(self, SYM_inputBuffer)
  Dim n As Long = js_length(buf)
  Dim kl As Long = js_length(k)
  Dim r As JsV = js_arr_new(0)
  For i As Long = 0 To n - 1 Step 16
    For j As Long = 0 To 15
      Dim b As Double = IIf(i + j < n, js_idxn(buf, i + j), 0)
      js_pushn(r, js_toi32(b) Xor js_toi32(js_idxn(k, j Mod kl)))
    Next
  Next
  js_setp(self, SYM_inputBuffer, js_arr_new(0))
  Return r
End Function

' ---- one vector ----
Function vh_cipher_names(ByRef c As String) As String
  Select Case c
    Case "AES", "Rijndael"
      Return "Rijndael (AES)"
    Case "3DES"
      Return "3DES (Triple DES)"
  End Select
  Return c
End Function

Sub vh_configure(ByRef spec As JsV, ByRef plan As JsV, ByRef inst As JsV, ByRef vec As JsV)
  Dim applied As JsV = js_obj_new()
  Dim tru As JsV = js_bool(-1)
  Dim fields As JsV = vh_get(plan, "fields")
  If js_truthy(vh_get(spec, "isMode")) Then
    Dim mode As JsV = vh_get(plan, "mode")
    Dim cipherName As JsV = vh_get(mode, "cipher")
    Dim cipher As JsV
    If cipherName.tag = JS_T_STR Then
      Dim found As JsV = vh_find(vh_cipher_names(JSS(cipherName)))
      If found.tag <> JS_T_OBJ Then found = vh_find(JSS(cipherName))
      If found.tag = JS_T_OBJ Then cipher = js_mcall1(found, SYM_CreateInstance, js_bool(0))
      If cipher.tag <> JS_T_OBJ Then js_throw_error("Vector field 'cipher' is not applied: no block cipher named '" & JSS(cipherName) & "' is registered")
    Else
      cipher = js_new0(CLS_VhDummy)
    End If
    If js_truthy(vh_get(spec, "multiKey")) = 0 Then
      If js_truthy(vh_get(mode, "keyTruthy")) Then
        js_setp(cipher, SYM_key, vh_field(vec, "key"))
      Else
        js_setp(cipher, SYM_key, js_arr_nums("0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15"))
      End If
    End If
    If js_truthy(js_mcall1(fields, SYM_includes, js_str("cipher"))) Then js_setp(applied, js_sym("cipher"), tru)
    If js_truthy(js_mcall1(fields, SYM_includes, js_str("key"))) AndAlso js_truthy(vh_get(spec, "multiKey")) = 0 Then js_setp(applied, js_sym("key"), tru)
    If js_has_method(inst, js_sym("setBlockCipher")) Then js_mcall1(inst, js_sym("setBlockCipher"), cipher)
    If js_has_method(inst, js_sym("setIV")) Then
      If js_truthy(vh_get(mode, "ivTruthy")) Then
        vh_set(inst, "iv", "setIV", vh_field(vec, "iv"))
        js_setp(applied, js_sym("iv"), tru)
      Else
        js_mcall1(inst, js_sym("setIV"), js_arr_nums("0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15"))
      End If
    End If
  End If
  Dim steps As JsV = vh_get(plan, "steps")
  For i As Long = 0 To js_length(steps) - 1
    Dim st As JsV = js_index_get(steps, i)
    Dim fld As String = js_tostring(vh_get(st, "field"))
    If vh_has_field(vec, fld) = 0 Then js_throw_error("Vector field '" & fld & "' is missing from the transpiled vector")
    Dim value As JsV = vh_field(vec, fld)
    Dim setterV As JsV = vh_get(st, "setter")
    Dim setter As String = IIf(setterV.tag = JS_T_STR, js_tostring(setterV), "")
    Dim kindV As JsV = vh_get(st, "kind")
    If kindV.tag = JS_T_STR AndAlso JSS(kindV) = "kek" Then
      Dim asKek As Long = vh_set(inst, "kek", "setKEK", value)
      Dim asKey As Long = 0
      If js_has_method(inst, js_sym("setKEK")) = 0 AndAlso js_has_method(inst, js_sym("setKey")) Then asKey = vh_set(inst, "key", "setKey", value)
      If asKek OrElse asKey Then js_setp(applied, js_sym("kek"), tru)
    ElseIf vh_set(inst, fld, setter, value) Then
      js_setp(applied, js_sym(fld), tru)
    End If
  Next
  For i As Long = 0 To js_length(fields) - 1
    Dim f As String = js_tostring(js_index_get(fields, i))
    If js_hasp(applied, js_sym(f)) = 0 Then js_throw_error("Vector field '" & f & "' is not applied: " & js_tostring(vh_get(spec, "name")) & " has no setter or property of that name")
  Next
End Sub

Function vh_run(ByRef alg As JsV, ByRef spec As JsV, ByRef plan As JsV, ByRef vec As JsV, ByVal inverse As Long, ByRef dat As JsV) As JsV
  Dim inst As JsV = js_mcall1(alg, SYM_CreateInstance, js_bool(inverse))
  If inst.tag <> JS_T_OBJ Then js_throw_error("Failed to create algorithm instance")
  vh_configure(spec, plan, inst, vec)
  js_mcall1(inst, SYM_Feed, dat)
  Dim r As JsV = js_mcall0(inst, SYM_Result)
  If r.tag = JS_T_OBJ AndAlso r.p->kind = JS_K_TYPED Then Return js_toarr(r)
  Return r
End Function

Function vh_check(ByRef alg As JsV, ByRef spec As JsV, ByRef plan As JsV, ByRef vec As JsV) As String
  Dim dat As JsV = vh_field(vec, "input")
  Dim inv As Long = js_truthy(vh_get(plan, "inverse"))
  Dim outv As JsV = vh_run(alg, spec, plan, vec, inv, dat)
  If js_truthy(vh_get(plan, "expect")) Then
    Dim ex As JsV = vh_field(vec, "expected")
    If vh_same(outv, ex) = 0 Then Return "output " & vh_hex(outv) & " expected " & vh_hex(ex)
  End If
  Dim rt As JsV = vh_get(plan, "rt")
  If rt.tag = JS_T_STR Then
    If JSS(rt) = "decode" Then
      Dim back As JsV = vh_run(alg, spec, plan, vec, inv = 0, outv)
      If vh_same(back, dat) = 0 Then Return "round trip gave " & vh_hex(back) & " expected the input " & vh_hex(dat)
    Else
      Dim decoded As JsV = vh_run(alg, spec, plan, vec, -1, outv)
      Dim again As JsV = vh_run(alg, spec, plan, vec, 0, decoded)
      If vh_same(again, outv) = 0 Then Return "encoding is not stable: re-encoding gave " & vh_hex(again) & " expected " & vh_hex(outv)
    End If
  End If
  Return ""
End Function

Sub vh_main()
  CLS_VhDummy = js_class_new("VhDummyInstance", 0, @vh_dummy_ctor)
  js_class_add(CLS_VhDummy, SYM_key, @vh_dummy_getkey, 1)
  js_class_add(CLS_VhDummy, SYM_key, @vh_dummy_setkey, 2)
  js_class_add(CLS_VhDummy, SYM_Feed, @vh_dummy_feed, 0)
  js_class_add(CLS_VhDummy, SYM_Result, @vh_dummy_result, 0)
  vh_json_pos = 0
  Dim spec As JsV = vh_json_value(vh_spec_text)
  Dim algs As JsV = vh_get(spec, "algorithms")
  For a As Long = 0 To js_length(algs) - 1
    Dim aspec As JsV = js_index_get(algs, a)
    Dim alg As JsV = vh_find(js_tostring(vh_get(aspec, "name")))
    If alg.tag <> JS_T_OBJ Then
      Print "@@ALGO "; a; " MISSING no algorithm named '"; vh_line(js_tostring(vh_get(aspec, "name"))); "' is registered"
      Continue For
    End If
    Dim tests As JsV = js_getp(alg, SYM_tests)
    Dim vecs As JsV = vh_get(aspec, "vectors")
    Dim nt As Long = IIf(js_truthy(tests), js_length(tests), 0)
    If nt <> js_length(vecs) Then Print "@@ALGO " & a & " COUNT " & nt
    For v As Long = 0 To js_length(vecs) - 1
      Dim failure As String
      If v >= nt Then
        failure = "vector missing"
      Else
        js_jmp_top += 1
        If setjmp(@js_jmp(js_jmp_top)) = 0 Then
          failure = vh_check(alg, aspec, js_index_get(vecs, v), js_index_get(tests, v))
          js_jmp_top -= 1
        Else
          js_jmp_top = -1
          failure = vh_describe(js_thrown)
        End If
      End If
      If Len(failure) = 0 Then
        Print "@@VEC " & a & " " & v & " PASS"
      Else
        Print "@@VEC " & a & " " & v & " FAIL " & vh_line(failure)
      End If
    Next
  Next
  Print "@@DONE"
End Sub

vh_main()
