// Test vector generation script
// Run this in the browser console with the cipher page loaded

function stringToHex(str) {
    var hex = '';
    for (var i = 0; i < str.length; i++) {
        var charCode = str.charCodeAt(i);
        hex += charCode.toString(16).padStart(2, '0');
    }
    return hex;
}

function generateTestVectors() {
    console.log('Generating test vectors...');
    
    // Test Caesar cipher
    var caesarId = Caesar.KeySetup('3');
    var caesarResult = Caesar.szEncryptBlock(caesarId, 'HELLO');
    console.log('Caesar HELLO with key 3:', caesarResult, 'hex:', stringToHex(caesarResult));
    Caesar.ClearData(caesarId);
    
    // Test BASE64
    var base64Id = BASE64.KeySetup('');
    var base64Result = BASE64.szEncryptBlock(base64Id, 'Man');
    console.log('BASE64 Man:', base64Result, 'hex:', stringToHex(base64Result));
    BASE64.ClearData(base64Id);
    
    // Test ROT13
    var rot13Id = ROT13.KeySetup('');
    var rot13Result = ROT13.szEncryptBlock(rot13Id, 'HELLO');
    console.log('ROT13 HELLO:', rot13Result, 'hex:', stringToHex(rot13Result));
    ROT13.ClearData(rot13Id);
    
    // Test TEA
    try {
        var teaId = TEA.KeySetup('1234567890123456');
        var teaResult = TEA.szEncryptBlock(teaId, 'TESTDATA');
        console.log('TEA TESTDATA with key 1234567890123456:', teaResult, 'hex:', stringToHex(teaResult));
        TEA.ClearData(teaId);
    } catch (e) {
        console.log('TEA error:', e.message);
    }
    
    // Test Blowfish
    try {
        var blowfishId = Blowfish.KeySetup('TESTKEY1');
        var blowfishResult = Blowfish.szEncryptBlock(blowfishId, 'TESTDATA');
        console.log('Blowfish TESTDATA with key TESTKEY1:', blowfishResult, 'hex:', stringToHex(blowfishResult));
        Blowfish.ClearData(blowfishId);
    } catch (e) {
        console.log('Blowfish error:', e.message);
    }
}