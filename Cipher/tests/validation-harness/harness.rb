# ---------------------------------------------------------------------------
# Vector harness appended to a transpiled Ruby algorithm by
# tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt
#
# The spec placeholder below is replaced by the harness spec of the reference
# run: the algorithms the file registers and, per vector, the fields to apply
# in TestEngine order and the checks the reference passed. Fields are applied
# with the semantics of TestEngine.ConfigureInstance: a field that reaches no
# setter or property, or whose setter raises, fails the vector. The transpiled
# code keeps JavaScript member names (see RubyTransformer.js), so a setter is
# the method of its name and a property the accessor of its name.
#
# Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
#                  @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
# ---------------------------------------------------------------------------
require 'json'

$stdout.sync = true
VH_SPEC = JSON.parse(<<~'__VH_SPEC__')
  __SPEC_JSON__
__VH_SPEC__
VH_DEFAULT_BYTES = (0..15).to_a.freeze
VH_CIPHER_NAMES = { 'AES' => 'Rijndael (AES)', 'Rijndael' => 'Rijndael (AES)', 'DES' => 'DES',
                    '3DES' => '3DES (Triple DES)', 'Blowfish' => 'Blowfish', 'Camellia' => 'Camellia',
                    'ARIA' => 'ARIA' }.freeze
VH_MISSING = Object.new.freeze

def vh_line(text) = text.to_s.gsub(/\s*[\r\n]+\s*/, ' | ')

def vh_describe(e)
  name = e.is_a?(JSError) ? e.js_name : e.class.name
  "#{name}: #{e.message}"
end

def vh_list(v)
  return nil if v.nil?
  return v.to_a if v.is_a?(Array) || v.respond_to?(:js_kind)
  v
end

def vh_same(a, b)
  a = vh_list(a)
  b = vh_list(b)
  return false unless a.is_a?(Array) && b.is_a?(Array) && a.length == b.length
  a.each_with_index.all? { |x, i| x.is_a?(Numeric) && b[i].is_a?(Numeric) && x == b[i] }
end

def vh_hex(v)
  v = vh_list(v)
  return v.inspect unless v.is_a?(Array)
  v.map { |b| b.is_a?(Integer) && b >= 0 && b < 256 ? format('%02x', b) : "<#{b.inspect}>" }.join
end

def vh_find(name) = $__js_algorithms.reverse.find { |a| a.name == name }

# A vector field's value, or VH_MISSING when the transpiled vector lacks it
def vh_field(vector, name)
  return VH_MISSING unless vector.respond_to?(:js_has?) && vector.js_has?(name)
  v = vector[name]
  v.respond_to?(:js_kind) ? v.to_a : v
end

def vh_method?(obj, name) = obj.respond_to?(JS.mangle(name))

# JavaScript's `name in instance`: an accessor, a declared field or an instance variable
def vh_property?(obj, name) = obj.respond_to?(:js_has?) ? obj.js_has?(name) : obj.respond_to?("#{JS.mangle(name)}=")

def vh_set_field(field)
  yield
rescue StandardError, SystemStackError => e
  raise JSError.new("Setting vector field '#{field}' failed: #{vh_describe(e)}")
end

def vh_apply(instance, field, setter, value)
  if setter && vh_method?(instance, setter)
    vh_set_field(field) { instance.public_send(JS.mangle(setter), value) }
    return true
  end
  if vh_property?(instance, field)
    vh_set_field(field) { instance[field] = value }
    return true
  end
  false
end

# The identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher
class VhDummyAlgorithm < JSBase
  attr_accessor :name, :BlockSize
  def initialize
    @name = 'DummyBlockCipher'
    @BlockSize = 16
  end

  def CreateInstance(_inverse = false, *_) = VhDummyInstance.new(self)
end

class VhDummyInstance < JSBase
  attr_accessor :algorithm, :BlockSize, :isInverse, :inputBuffer
  def initialize(algorithm)
    @algorithm = algorithm
    @BlockSize = 16
    @isInverse = false
    @key = nil
    @inputBuffer = []
  end

  def key = @key ? @key.to_a.dup : nil
  def key=(value)
    @key = value && !value.to_a.empty? ? value.to_a.dup : nil
  end

  def Feed(data, *_)
    @inputBuffer.concat(data.to_a) if data
    nil
  end

  def Result(*_)
    raise JSError.new('Key not set') unless @key
    out = []
    (0...@inputBuffer.length).step(16) do |i|
      block = @inputBuffer[i, 16]
      block += [0] * (16 - block.length)
      16.times { |j| out << (block[j] ^ @key[j % @key.length]) }
    end
    @inputBuffer = []
    out
  end
end

def vh_configure(spec, plan, instance, vector)
  applied = {}
  if spec['isMode']
    mode = plan['mode']
    if mode['cipher']
      found = vh_find(VH_CIPHER_NAMES[mode['cipher']] || mode['cipher']) || vh_find(mode['cipher'])
      cipher = found&.CreateInstance(false)
      raise JSError.new("Vector field 'cipher' is not applied: no block cipher named '#{mode['cipher']}' is registered") if cipher.nil?
    else
      cipher = VhDummyInstance.new(VhDummyAlgorithm.new)
    end
    cipher.key = mode['keyTruthy'] ? vh_field(vector, 'key') : VH_DEFAULT_BYTES.dup unless spec['multiKey']
    applied['cipher'] = true if plan['fields'].include?('cipher')
    applied['key'] = true if plan['fields'].include?('key') && !spec['multiKey']
    instance.setBlockCipher(cipher) if vh_method?(instance, 'setBlockCipher')
    if vh_method?(instance, 'setIV')
      if mode['ivTruthy']
        iv = vh_field(vector, 'iv')
        vh_set_field('iv') { instance.setIV(iv) }
        applied['iv'] = true
      else
        instance.setIV(VH_DEFAULT_BYTES.dup)
      end
    end
  end

  plan['steps'].each do |step|
    field = step['field']
    value = vh_field(vector, field)
    raise JSError.new("Vector field '#{field}' is missing from the transpiled vector") if value.equal?(VH_MISSING)
    if step['kind'] == 'kek'
      as_kek = vh_apply(instance, 'kek', 'setKEK', value)
      as_key = !vh_method?(instance, 'setKEK') && vh_method?(instance, 'setKey') && vh_apply(instance, 'key', 'setKey', value)
      applied['kek'] = true if as_kek || as_key
    elsif vh_apply(instance, field, step['setter'], value)
      applied[field] = true
    end
  end

  plan['fields'].each do |field|
    next if applied[field]
    raise JSError.new("Vector field '#{field}' is not applied: #{spec['name']} has no setter or property of that name")
  end
end

def vh_run(algorithm, spec, plan, vector, inverse, data)
  instance = algorithm.CreateInstance(inverse)
  raise JSError.new("Failed to create algorithm instance (inverse=#{inverse})") if instance.nil?
  vh_configure(spec, plan, instance, vector)
  instance.Feed(data)
  vh_list(instance.Result())
end

def vh_check(algorithm, spec, plan, vector)
  data = vh_field(vector, 'input')
  data = nil if data.equal?(VH_MISSING)
  output = vh_run(algorithm, spec, plan, vector, plan['inverse'], data)
  if plan['expect']
    expected = vh_field(vector, 'expected')
    return "output #{vh_hex(output)} expected #{vh_hex(expected)}" unless vh_same(output, expected)
  end
  case plan['rt']
  when 'decode'
    back = vh_run(algorithm, spec, plan, vector, !plan['inverse'], output)
    return "round trip gave #{vh_hex(back)} expected the input #{vh_hex(data)}" unless vh_same(back, data)
  when 'stability'
    decoded = vh_run(algorithm, spec, plan, vector, true, output)
    again = vh_run(algorithm, spec, plan, vector, false, decoded)
    return "encoding is not stable: re-encoding gave #{vh_hex(again)} expected #{vh_hex(output)}" unless vh_same(again, output)
  end
  nil
end

def vh_main
  VH_SPEC['algorithms'].each_with_index do |spec, a|
    algorithm = begin
      vh_find(spec['name'])
    rescue StandardError => e
      puts "@@ALGO #{a} MISSING #{vh_line(vh_describe(e))}"
      next
    end
    if algorithm.nil?
      puts "@@ALGO #{a} MISSING no algorithm named '#{vh_line(spec['name'])}' is registered"
      next
    end
    tests = (algorithm.tests || []).to_a
    puts "@@ALGO #{a} COUNT #{tests.length}" if tests.length != spec['vectors'].length
    spec['vectors'].each_with_index do |plan, v|
      failure = begin
        v < tests.length ? vh_check(algorithm, spec, plan, tests[v]) : 'vector missing'
      rescue StandardError, SystemStackError => e
        vh_describe(e)
      end
      puts "@@VEC #{a} #{v} #{failure.nil? ? 'PASS' : "FAIL #{vh_line(failure)}"}"
    end
  end
  puts '@@DONE'
end

vh_main
