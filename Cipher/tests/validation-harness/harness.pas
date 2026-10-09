{ ---------------------------------------------------------------------------
  Vector harness compiled with a transpiled Delphi/Free Pascal algorithm unit
  by tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt

  The unit placeholder below is replaced by the transpiled unit's name; the
  harness spec of the reference run (the algorithms the file registers and,
  per vector, the fields to apply in TestEngine order and the checks the
  reference passed) is read from spec.json next to the program. Fields are
  applied with the semantics of TestEngine.ConfigureInstance: a field that
  reaches no setter method or member, or whose setter raises, fails the
  vector. Members and setters are found by their JavaScript names through
  the dispatchers the transpiler generates (JsHasMember/JsSetMember,
  JsHasMethod/JsCallMethod).

  Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
                   @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
  --------------------------------------------------------------------------- }
program TestHarness;

{$MODE DELPHIUNICODE}
{$Q-}{$R-}

uses
  SysUtils, Classes, fpjson, jsonparser, __UNIT__;

type
  { The identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher }
  TVhDummyAlgorithm = class(TBlockCipherAlgorithm)
  public
    constructor Create;
    function CreateInstance(isInverse: Boolean = False): TIAlgorithmInstance; override;
  end;

  TVhDummyInstance = class(TIBlockCipherInstance)
  public
    constructor Create(AAlgorithm: TAlgorithm);
    procedure Set_key(keyBytes: TA_U8); override;
    function Get_key: TA_U8; override;
    procedure Feed(data: TA_U8); override;
    function Result_: TA_U8; override;
  end;

constructor TVhDummyAlgorithm.Create;
begin
  inherited Create;
  name := 'DummyBlockCipher';
end;

function TVhDummyAlgorithm.CreateInstance(isInverse: Boolean): TIAlgorithmInstance;
begin
  Result := TVhDummyInstance.Create(Self);
end;

constructor TVhDummyInstance.Create(AAlgorithm: TAlgorithm);
begin
  inherited Create(AAlgorithm);
  BlockSize := 16;
  inputBuffer := TA_U8.Empty;
end;

procedure TVhDummyInstance.Set_key(keyBytes: TA_U8);
begin
  if keyBytes.IsNull then _key := TA_U8.Null else _key := keyBytes.Copy;
end;

function TVhDummyInstance.Get_key: TA_U8;
begin
  if _key.IsNull then Result := TA_U8.Null else Result := _key.Copy;
end;

procedure TVhDummyInstance.Feed(data: TA_U8);
begin
  if not data.IsNull then inputBuffer.PushAll(data);
end;

function TVhDummyInstance.Result_: TA_U8;
var I, J: Int32;
begin
  if _key.IsNull or (_key.length = 0) then raise EJsError.Create('Key not set');
  Result := TA_U8.Empty;
  I := 0;
  while I < inputBuffer.length do
  begin
    for J := 0 to 15 do Result.Push(inputBuffer[I + J] xor _key[J mod _key.length]);
    I := I + 16;
  end;
  inputBuffer := TA_U8.Empty;
end;

function OneLine(const S: string): string;
var I: Int32; InBreak: Boolean;
begin
  Result := '';
  InBreak := False;
  for I := 1 to Length(S) do
    if (S[I] = #13) or (S[I] = #10) then
    begin
      if not InBreak then Result := TrimRight(Result) + ' | ';
      InBreak := True;
    end
    else if not (InBreak and (S[I] = ' ')) then
    begin
      Result := Result + S[I];
      InBreak := False;
    end;
end;

function Hex(const A: TA_U8): string;
var I: Int32;
begin
  if A.IsNull then Exit('<null>');
  Result := '';
  for I := 0 to A.length - 1 do Result := Result + LowerCase(IntToHex(A[I], 2));
end;

function SameBytes(const A, B: TA_U8): Boolean;
var I: Int32;
begin
  if A.IsNull or B.IsNull or (A.length <> B.length) then Exit(False);
  for I := 0 to A.length - 1 do
    if A[I] <> B[I] then Exit(False);
  Result := True;
end;

function DefaultBytes: TA_U8;
var I: Int32;
begin
  Result := TA_U8.New(16);
  for I := 0 to 15 do Result[I] := I;
end;

function CipherName(const N: string): string;
begin
  if (N = 'AES') or (N = 'Rijndael') then Result := 'Rijndael (AES)'
  else if N = '3DES' then Result := '3DES (Triple DES)'
  else Result := N;
end;

procedure SetVectorField(Inst: TJsObject; const Field, Name: string; const Value: TJsValue; AsMethod: Boolean);
begin
  try
    if AsMethod then Inst.JsCallMethod(Name, Value) else Inst.JsSetMember(Name, Value);
  except
    on E: Exception do
      raise EJsError.Create('Setting vector field ''' + Field + ''' failed: ' + JsDescribeException(E));
  end;
end;

{ A setter method of that name, else a member of the field's name }
function ApplyProperty(Inst: TJsObject; const Field, Setter: string; const Value: TJsValue): Boolean;
begin
  if (Setter <> '') and Inst.JsHasMethod(Setter) then
  begin
    SetVectorField(Inst, Field, Setter, Value, True);
    Exit(True);
  end;
  if Inst.JsHasMember(Field) then
  begin
    SetVectorField(Inst, Field, Field, Value, False);
    Exit(True);
  end;
  Result := False;
end;

function StrOf(Obj: TJSONObject; const Key: string): string;
var D: TJSONData;
begin
  D := Obj.Find(Key);
  if (D = nil) or (D.JSONType <> jtString) then Result := '' else Result := UTF8Decode(D.AsString);
end;

function BoolOf(Obj: TJSONObject; const Key: string): Boolean;
var D: TJSONData;
begin
  D := Obj.Find(Key);
  Result := (D <> nil) and (D.JSONType = jtBoolean) and D.AsBoolean;
end;

function VectorValue(Vector: TTestCase; const Field: string): TJsValue;
begin
  if not Vector.HasField(Field) then
    raise EJsError.Create('Vector field ''' + Field + ''' is missing from the transpiled vector');
  Result := Vector.GetField(Field);
end;

procedure Configure(Spec, Plan: TJSONObject; Inst: TIAlgorithmInstance; Vector: TTestCase);
var
  Applied: TStringList;
  Fields, Steps: TJSONArray;
  Mode, Step: TJSONObject;
  CipherAlg: TAlgorithm;
  Cipher: TIAlgorithmInstance;
  CipherNameStr, Field, Setter, Kind: string;
  Value: TJsValue;
  I: Int32;
  AsKek, AsKey: Boolean;
begin
  Applied := TStringList.Create;
  try
    Fields := Plan.Arrays['fields'];
    if BoolOf(Spec, 'isMode') then
    begin
      Mode := Plan.Objects['mode'];
      CipherNameStr := StrOf(Mode, 'cipher');
      if (Mode.Find('cipher') <> nil) and (Mode.Find('cipher').JSONType = jtString) then
      begin
        CipherAlg := JsFindAlgorithm(CipherName(CipherNameStr));
        if CipherAlg = nil then CipherAlg := JsFindAlgorithm(CipherNameStr);
        Cipher := nil;
        if CipherAlg <> nil then Cipher := CipherAlg.CreateInstance(False);
        if Cipher = nil then
          raise EJsError.Create('Vector field ''cipher'' is not applied: no block cipher named ''' + CipherNameStr + ''' is registered');
      end
      else
        Cipher := TVhDummyAlgorithm.Create.CreateInstance(False);
      if not BoolOf(Spec, 'multiKey') then
      begin
        if BoolOf(Mode, 'keyTruthy') then Value := VectorValue(Vector, 'key') else Value := JsVArr_U8(DefaultBytes);
        if not Cipher.JsSetMember('key', Value) then
          raise EJsError.Create('the block cipher instance ' + Cipher.ClassName + ' has no key');
      end;
      for I := 0 to Fields.Count - 1 do
      begin
        if Fields.Strings[I] = 'cipher' then Applied.Add('cipher');
        if (Fields.Strings[I] = 'key') and not BoolOf(Spec, 'multiKey') then Applied.Add('key');
      end;
      if Inst.JsHasMethod('setBlockCipher') then Inst.JsCallMethod('setBlockCipher', JsVObj(Cipher));
      if Inst.JsHasMethod('setIV') then
      begin
        if BoolOf(Mode, 'ivTruthy') then
        begin
          SetVectorField(Inst, 'iv', 'setIV', VectorValue(Vector, 'iv'), True);
          Applied.Add('iv');
        end
        else
          Inst.JsCallMethod('setIV', JsVArr_U8(DefaultBytes));
      end;
    end;

    Steps := Plan.Arrays['steps'];
    for I := 0 to Steps.Count - 1 do
    begin
      Step := Steps.Objects[I];
      Field := StrOf(Step, 'field');
      Setter := StrOf(Step, 'setter');
      Kind := StrOf(Step, 'kind');
      if BoolOf(Step, 'isNull') then Value := JsVNull else Value := VectorValue(Vector, Field);
      if Kind = 'kek' then
      begin
        AsKek := ApplyProperty(Inst, 'kek', 'setKEK', Value);
        AsKey := not Inst.JsHasMethod('setKEK') and Inst.JsHasMethod('setKey') and ApplyProperty(Inst, 'key', 'setKey', Value);
        if AsKek or AsKey then Applied.Add('kek');
      end
      else if ApplyProperty(Inst, Field, Setter, Value) then
        Applied.Add(Field);
    end;

    for I := 0 to Fields.Count - 1 do
      if Applied.IndexOf(Fields.Strings[I]) < 0 then
        raise EJsError.Create('Vector field ''' + Fields.Strings[I] + ''' is not applied: ' + StrOf(Spec, 'name') +
          ' has no setter or property of that name');
  finally
    Applied.Free;
  end;
end;

function RunOnce(Alg: TAlgorithm; Spec, Plan: TJSONObject; Vector: TTestCase; Inverse: Boolean; const Data: TA_U8): TA_U8;
var Inst: TIAlgorithmInstance;
begin
  Inst := Alg.CreateInstance(Inverse);
  if Inst = nil then raise EJsError.Create('Failed to create algorithm instance (inverse=' + BoolToStr(Inverse, 'true', 'false') + ')');
  Configure(Spec, Plan, Inst, Vector);
  Inst.Feed(Data);
  Result := Inst.Result_;
end;

function CheckVector(Alg: TAlgorithm; Spec, Plan: TJSONObject; Vector: TTestCase): string;
var Input, Output, Back, Decoded, Again: TA_U8; Inverse: Boolean; Rt: string;
begin
  Inverse := BoolOf(Plan, 'inverse');
  Input := Vector.input;
  Output := RunOnce(Alg, Spec, Plan, Vector, Inverse, Input);
  if BoolOf(Plan, 'expect') and not SameBytes(Output, Vector.expected) then
    Exit('output ' + Hex(Output) + ' expected ' + Hex(Vector.expected));
  Rt := StrOf(Plan, 'rt');
  if Rt = 'decode' then
  begin
    Back := RunOnce(Alg, Spec, Plan, Vector, not Inverse, Output);
    if not SameBytes(Back, Input) then Exit('round trip gave ' + Hex(Back) + ' expected the input ' + Hex(Input));
  end
  else if Rt = 'stability' then
  begin
    Decoded := RunOnce(Alg, Spec, Plan, Vector, True, Output);
    Again := RunOnce(Alg, Spec, Plan, Vector, False, Decoded);
    if not SameBytes(Again, Output) then Exit('encoding is not stable: re-encoding gave ' + Hex(Again) + ' expected ' + Hex(Output));
  end;
  Result := '';
end;

procedure Main;
var
  SpecText: TStringList;
  Root: TJSONData;
  Algorithms, Vectors: TJSONArray;
  Spec, Plan: TJSONObject;
  Alg: TAlgorithm;
  Tests: TA_TestCase;
  A, V: Int32;
  Failure: string;
begin
  SpecText := TStringList.Create;
  try
    SpecText.LoadFromFile(ExtractFilePath(ParamStr(0)) + 'spec.json');
    Root := GetJSON(SpecText.Text);
  finally
    SpecText.Free;
  end;
  Algorithms := TJSONObject(Root).Arrays['algorithms'];
  for A := 0 to Algorithms.Count - 1 do
  begin
    Spec := Algorithms.Objects[A];
    try
      Alg := JsFindAlgorithm(StrOf(Spec, 'name'));
    except
      on E: Exception do
      begin
        WriteLn('@@ALGO ', A, ' MISSING ', OneLine(JsDescribeException(E)));
        Flush(Output);
        Continue;
      end;
    end;
    if Alg = nil then
    begin
      WriteLn('@@ALGO ', A, ' MISSING no algorithm named ''', OneLine(StrOf(Spec, 'name')), ''' is registered');
      Flush(Output);
      Continue;
    end;
    Tests := Alg.tests;
    Vectors := Spec.Arrays['vectors'];
    if Tests.length <> Vectors.Count then WriteLn('@@ALGO ', A, ' COUNT ', Tests.length);
    for V := 0 to Vectors.Count - 1 do
    begin
      Plan := Vectors.Objects[V];
      try
        if V < Tests.length then Failure := CheckVector(Alg, Spec, Plan, Tests[V]) else Failure := 'vector missing';
      except
        on E: Exception do Failure := JsDescribeException(E);
      end;
      if Failure = '' then WriteLn('@@VEC ', A, ' ', V, ' PASS')
      else WriteLn('@@VEC ', A, ' ', V, ' FAIL ', OneLine(Failure));
      Flush(Output);
    end;
  end;
  WriteLn('@@DONE');
  Flush(Output);
end;

begin
  Main;
end.
