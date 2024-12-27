/*	-----------------------------------------------------------------------------
	Square.java

	Ported from the C code reference implementation of SQUARE -Version 2.1.1
	(1997.02.07)- by the designers of the algorithm:

		<a href="mailto:joan.daemen@club.innet.be">Joan Daemen</a> and
		<a href="mailto:vincent.rijmen@esat.kuleuven.ac.be">Vincent Rijmen</a>.

	This C-code version was chosen in preference to the ver.2.6 because (a) it
	is clearer (in terms of the transformation steps applied to both the key
	and the data, and (b) more compact. Note however that it's the version 2.6,
	public domain implementation by <a href="mailto:pbarreto@uninet.com.br">Paulo
	S.L.M. Barreto</a> and <a href="mailto:george.barwood@dial.pipex.com">George
	Barwood</a>, that we will be using as the basis for the native library because
	it's optimised with assembler code for the de-facto PC platform.


	Copyright &copy;1997, Type & Graphics Pty Limited. All rights reserved.
	----------------------------------------------------------------------------- */

package cryptix.security;


import java.security.Cipher;
import java.security.Key;
import java.security.KeyException;
import java.security.Security;
import java.security.SymmetricCipher;

/**	
 *	A subclass of Cipher to implement a Java class of the Square algorithm.
 *
 *	Square is a cipher algorithm developed by Joan Daemen <Daemen.J@banksys.com>
 *	and Vincent Rijmen <vincent.rijmen@esat.kuleuven.ac.be>
 *	<p>
 *	Reference:<ol>
 *	<li><a href="http://www.esat.kuleuven.ac.be/%7Erijmen/square/">Square home
 *	page</a>.</ol>
 *
 *	@version	1.0 --July 97
 *	@author		Raif S. Naffah
 */
public class Square
extends Cipher
implements SymmetricCipher
{

// Variables and constants
//............................................................................

	/**
	 *	Encryption and decryption Square S-Box values
	 */
	private static final byte[] SE = {
		(byte)177, (byte)206, (byte)195, (byte)149,
		(byte) 90, (byte)173, (byte)231, (byte)  2,
		(byte) 77, (byte) 68, (byte)251, (byte)145,
		(byte) 12, (byte)135, (byte)161, (byte) 80,
		(byte)203, (byte)103, (byte) 84, (byte)221,
		(byte) 70, (byte)143, (byte)225, (byte) 78,
		(byte)240, (byte)253, (byte)252, (byte)235,
		(byte)249, (byte)196, (byte) 26, (byte)110,
		(byte) 94, (byte)245, (byte)204, (byte)141,
		(byte) 28, (byte) 86, (byte) 67, (byte)254,
		(byte)  7, (byte) 97, (byte)248, (byte)117,
		(byte) 89, (byte)255, (byte)  3, (byte) 34,
		(byte)138, (byte)209, (byte) 19, (byte)238,
		(byte)136, (byte)  0, (byte) 14, (byte) 52,
		(byte) 21, (byte)128, (byte)148, (byte)227,
		(byte)237, (byte)181, (byte) 83, (byte) 35,
		(byte) 75, (byte) 71, (byte) 23, (byte)167,
		(byte)144, (byte) 53, (byte)171, (byte)216,
		(byte)184, (byte)223, (byte) 79, (byte) 87,
		(byte)154, (byte)146, (byte)219, (byte) 27,
		(byte) 60, (byte)200, (byte)153, (byte)  4,
		(byte)142, (byte)224, (byte)215, (byte)125,
		(byte)133, (byte)187, (byte) 64, (byte) 44,
		(byte) 58, (byte) 69, (byte)241, (byte) 66,
		(byte)101, (byte) 32, (byte) 65, (byte) 24,
		(byte)114, (byte) 37, (byte)147, (byte)112,
		(byte) 54, (byte)  5, (byte)242, (byte) 11,
		(byte)163, (byte)121, (byte)236, (byte)  8,
		(byte) 39, (byte) 49, (byte) 50, (byte)182,
		(byte)124, (byte)176, (byte) 10, (byte)115,
		(byte) 91, (byte)123, (byte)183, (byte)129,
		(byte)210, (byte) 13, (byte)106, (byte) 38,
		(byte)158, (byte) 88, (byte)156, (byte)131,
		(byte)116, (byte)179, (byte)172, (byte) 48,
		(byte)122, (byte)105, (byte)119, (byte) 15,
		(byte)174, (byte) 33, (byte)222, (byte)208,
		(byte) 46, (byte)151, (byte) 16, (byte)164,
		(byte)152, (byte)168, (byte)212, (byte)104,
		(byte) 45, (byte) 98, (byte) 41, (byte)109,
		(byte) 22, (byte) 73, (byte)118, (byte)199,
		(byte)232, (byte)193, (byte)150, (byte) 55,
		(byte)229, (byte)202, (byte)244, (byte)233,
		(byte) 99, (byte) 18, (byte)194, (byte)166,
		(byte) 20, (byte)188, (byte)211, (byte) 40,
		(byte)175, (byte) 47, (byte)230, (byte) 36,
		(byte) 82, (byte)198, (byte)160, (byte)  9,
		(byte)189, (byte)140, (byte)207, (byte) 93,
		(byte) 17, (byte) 95, (byte)  1, (byte)197,
		(byte)159, (byte) 61, (byte)162, (byte)155,
		(byte)201, (byte) 59, (byte)190, (byte) 81,
		(byte) 25, (byte) 31, (byte) 63, (byte) 92,
		(byte)178, (byte)239, (byte) 74, (byte)205,
		(byte)191, (byte)186, (byte)111, (byte)100,
		(byte)217, (byte)243, (byte) 62, (byte)180,
		(byte)170, (byte)220, (byte)213, (byte)  6,
		(byte)192, (byte)126, (byte)246, (byte)102,
		(byte)108, (byte)132, (byte)113, (byte) 56,
		(byte)185, (byte) 29, (byte)127, (byte)157,
		(byte) 72, (byte)139, (byte) 42, (byte)218,
		(byte)165, (byte) 51, (byte)130, (byte) 57,
		(byte)214, (byte)120, (byte)134, (byte)250,
		(byte)228, (byte) 43, (byte)169, (byte) 30,
		(byte)137, (byte) 96, (byte)107, (byte)234,
		(byte) 85, (byte) 76, (byte)247, (byte)226};

	private static final byte[] SD = {
		(byte) 53, (byte)190, (byte)  7, (byte) 46,
		(byte) 83, (byte)105, (byte)219, (byte) 40,
		(byte)111, (byte)183, (byte)118, (byte)107,
		(byte) 12, (byte)125, (byte) 54, (byte)139,
		(byte)146, (byte)188, (byte)169, (byte) 50,
		(byte)172, (byte) 56, (byte)156, (byte) 66,
		(byte) 99, (byte)200, (byte) 30, (byte) 79,
		(byte) 36, (byte)229, (byte)247, (byte)201,
		(byte) 97, (byte)141, (byte) 47, (byte) 63,
		(byte)179, (byte)101, (byte)127, (byte)112,
		(byte)175, (byte)154, (byte)234, (byte)245,
		(byte) 91, (byte)152, (byte)144, (byte)177,
		(byte)135, (byte)113, (byte)114, (byte)237,
		(byte) 55, (byte) 69, (byte)104, (byte)163,
		(byte)227, (byte)239, (byte) 92, (byte)197,
		(byte) 80, (byte)193, (byte)214, (byte)202,
		(byte) 90, (byte) 98, (byte) 95, (byte) 38,
		(byte)  9, (byte) 93, (byte) 20, (byte) 65,
		(byte)232, (byte)157, (byte)206, (byte) 64,
		(byte)253, (byte)  8, (byte) 23, (byte) 74,
		(byte) 15, (byte)199, (byte)180, (byte) 62,
		(byte) 18, (byte)252, (byte) 37, (byte) 75,
		(byte)129, (byte) 44, (byte)  4, (byte)120,
		(byte)203, (byte)187, (byte) 32, (byte)189,
		(byte)249, (byte) 41, (byte)153, (byte)168,
		(byte)211, (byte) 96, (byte)223, (byte) 17,
		(byte)151, (byte)137, (byte)126, (byte)250,
		(byte)224, (byte)155, (byte) 31, (byte)210,
		(byte)103, (byte)226, (byte)100, (byte)119,
		(byte)132, (byte) 43, (byte)158, (byte)138,
		(byte)241, (byte)109, (byte)136, (byte)121,
		(byte)116, (byte) 87, (byte)221, (byte)230,
		(byte) 57, (byte)123, (byte)238, (byte)131,
		(byte)225, (byte) 88, (byte)242, (byte) 13,
		(byte) 52, (byte)248, (byte) 48, (byte)233,
		(byte)185, (byte) 35, (byte) 84, (byte) 21,
		(byte) 68, (byte) 11, (byte) 77, (byte)102,
		(byte) 58, (byte)  3, (byte)162, (byte)145,
		(byte)148, (byte) 82, (byte) 76, (byte)195,
		(byte)130, (byte)231, (byte)128, (byte)192,
		(byte)182, (byte) 14, (byte)194, (byte)108,
		(byte)147, (byte)236, (byte)171, (byte) 67,
		(byte)149, (byte)246, (byte)216, (byte) 70,
		(byte)134, (byte)  5, (byte)140, (byte)176,
		(byte)117, (byte)  0, (byte)204, (byte)133,
		(byte)215, (byte) 61, (byte)115, (byte)122,
		(byte) 72, (byte)228, (byte)209, (byte) 89,
		(byte)173, (byte)184, (byte)198, (byte)208,
		(byte)220, (byte)161, (byte)170, (byte)  2,
		(byte) 29, (byte)191, (byte)181, (byte)159,
		(byte) 81, (byte)196, (byte)165, (byte) 16,
		(byte) 34, (byte)207, (byte)  1, (byte)186,
		(byte)143, (byte) 49, (byte)124, (byte)174,
		(byte)150, (byte)218, (byte)240, (byte) 86,
		(byte) 71, (byte)212, (byte)235, (byte) 78,
		(byte)217, (byte) 19, (byte)142, (byte) 73,
		(byte) 85, (byte) 22, (byte)255, (byte) 59,
		(byte)244, (byte)164, (byte)178, (byte)  6,
		(byte)160, (byte)167, (byte)251, (byte) 27,
		(byte)110, (byte) 60, (byte) 51, (byte)205,
		(byte) 24, (byte) 94, (byte)106, (byte)213,
		(byte)166, (byte) 33, (byte)222, (byte)254,
		(byte) 42, (byte) 28, (byte)243, (byte) 10,
		(byte) 26, (byte) 25, (byte) 39, (byte) 45};
		
	private static final int[] TE = {
		0x97B1B126, 0x69CECEA7, 0x73C3C3B0, 0xDF95954A, 
		0xB45A5AEE, 0xAFADAD02, 0x3BE7E7DC, 0x04020206, 
		0x9A4D4DD7, 0x884444CC, 0x03FBFBF8, 0xD7919146, 
		0x180C0C14, 0xFB87877C, 0xB7A1A116, 0xA05050F0, 
		0x63CBCBA8, 0xCE6767A9, 0xA85454FC, 0x4FDDDD92, 
		0x8C4646CA, 0xEB8F8F64, 0x37E1E1D6, 0x9C4E4ED2, 
		0x15F0F0E5, 0x0FFDFDF2, 0x0DFCFCF1, 0x23EBEBC8, 
		0x07F9F9FE, 0x7DC4C4B9, 0x341A1A2E, 0xDC6E6EB2, 
		0xBC5E5EE2, 0x1FF5F5EA, 0x6DCCCCA1, 0xEF8D8D62, 
		0x381C1C24, 0xAC5656FA, 0x864343C5, 0x09FEFEF7, 
		0x0E070709, 0xC26161A3, 0x05F8F8FD, 0xEA75759F, 
		0xB25959EB, 0x0BFFFFF4, 0x06030305, 0x44222266, 
		0xE18A8A6B, 0x57D1D186, 0x26131335, 0x29EEEEC7, 
		0xE588886D, 0x00000000, 0x1C0E0E12, 0x6834345C, 
		0x2A15153F, 0xF5808075, 0xDD949449, 0x33E3E3D0, 
		0x2FEDEDC2, 0x9FB5B52A, 0xA65353F5, 0x46232365, 
		0x964B4BDD, 0x8E4747C9, 0x2E171739, 0xBBA7A71C, 
		0xD5909045, 0x6A35355F, 0xA3ABAB08, 0x45D8D89D, 
		0x85B8B83D, 0x4BDFDF94, 0x9E4F4FD1, 0xAE5757F9, 
		0xC19A9A5B, 0xD1929243, 0x43DBDB98, 0x361B1B2D, 
		0x783C3C44, 0x65C8C8AD, 0xC799995E, 0x0804040C, 
		0xE98E8E67, 0x35E0E0D5, 0x5BD7D78C, 0xFA7D7D87, 
		0xFF85857A, 0x83BBBB38, 0x804040C0, 0x582C2C74, 
		0x743A3A4E, 0x8A4545CF, 0x17F1F1E6, 0x844242C6, 
		0xCA6565AF, 0x40202060, 0x824141C3, 0x30181828, 
		0xE4727296, 0x4A25256F, 0xD3939340, 0xE0707090, 
		0x6C36365A, 0x0A05050F, 0x11F2F2E3, 0x160B0B1D, 
		0xB3A3A310, 0xF279798B, 0x2DECECC1, 0x10080818, 
		0x4E272769, 0x62313153, 0x64323256, 0x99B6B62F, 
		0xF87C7C84, 0x95B0B025, 0x140A0A1E, 0xE6737395, 
		0xB65B5BED, 0xF67B7B8D, 0x9BB7B72C, 0xF7818176, 
		0x51D2D283, 0x1A0D0D17, 0xD46A6ABE, 0x4C26266A, 
		0xC99E9E57, 0xB05858E8, 0xCD9C9C51, 0xF3838370, 
		0xE874749C, 0x93B3B320, 0xADACAC01, 0x60303050, 
		0xF47A7A8E, 0xD26969BB, 0xEE777799, 0x1E0F0F11, 
		0xA9AEAE07, 0x42212163, 0x49DEDE97, 0x55D0D085, 
		0x5C2E2E72, 0xDB97974C, 0x20101030, 0xBDA4A419, 
		0xC598985D, 0xA5A8A80D, 0x5DD4D489, 0xD06868B8, 
		0x5A2D2D77, 0xC46262A6, 0x5229297B, 0xDA6D6DB7, 
		0x2C16163A, 0x924949DB, 0xEC76769A, 0x7BC7C7BC, 
		0x25E8E8CD, 0x77C1C1B6, 0xD996964F, 0x6E373759, 
		0x3FE5E5DA, 0x61CACAAB, 0x1DF4F4E9, 0x27E9E9CE, 
		0xC66363A5, 0x24121236, 0x71C2C2B3, 0xB9A6A61F, 
		0x2814143C, 0x8DBCBC31, 0x53D3D380, 0x50282878, 
		0xABAFAF04, 0x5E2F2F71, 0x39E6E6DF, 0x4824246C, 
		0xA45252F6, 0x79C6C6BF, 0xB5A0A015, 0x1209091B, 
		0x8FBDBD32, 0xED8C8C61, 0x6BCFCFA4, 0xBA5D5DE7, 
		0x22111133, 0xBE5F5FE1, 0x02010103, 0x7FC5C5BA, 
		0xCB9F9F54, 0x7A3D3D47, 0xB1A2A213, 0xC39B9B58, 
		0x67C9C9AE, 0x763B3B4D, 0x89BEBE37, 0xA25151F3, 
		0x3219192B, 0x3E1F1F21, 0x7E3F3F41, 0xB85C5CE4, 
		0x91B2B223, 0x2BEFEFC4, 0x944A4ADE, 0x6FCDCDA2, 
		0x8BBFBF34, 0x81BABA3B, 0xDE6F6FB1, 0xC86464AC, 
		0x47D9D99E, 0x13F3F3E0, 0x7C3E3E42, 0x9DB4B429, 
		0xA1AAAA0B, 0x4DDCDC91, 0x5FD5D58A, 0x0C06060A, 
		0x75C0C0B5, 0xFC7E7E82, 0x19F6F6EF, 0xCC6666AA, 
		0xD86C6CB4, 0xFD848479, 0xE2717193, 0x70383848, 
		0x87B9B93E, 0x3A1D1D27, 0xFE7F7F81, 0xCF9D9D52, 
		0x904848D8, 0xE38B8B68, 0x542A2A7E, 0x41DADA9B, 
		0xBFA5A51A, 0x66333355, 0xF1828273, 0x7239394B, 
		0x59D6D68F, 0xF0787888, 0xF986867F, 0x01FAFAFB, 
		0x3DE4E4D9, 0x562B2B7D, 0xA7A9A90E, 0x3C1E1E22, 
		0xE789896E, 0xC06060A0, 0xD66B6BBD, 0x21EAEACB, 
		0xAA5555FF, 0x984C4CD4, 0x1BF7F7EC, 0x31E2E2D3};
		
	private static final int[] TD = {
		0xE368BC02, 0x5585620C, 0x2A3F2331, 0x61AB13F7, 
		0x98D46D72, 0x21CB9A19, 0x3C22A461, 0x459D3DCD, 
		0x05FDB423, 0x2BC4075F, 0x9B2C01C0, 0x3DD9800F, 
		0x486C5C74, 0xF97F7E85, 0xF173AB1F, 0xB6EDDE0E, 
		0x283C6BED, 0x4997781A, 0x9F2A918D, 0xC9579F33, 
		0xA907A8AA, 0xA50DED7D, 0x7C422D8F, 0x764DB0C9, 
		0x4D91E857, 0xCEA963CC, 0xB4EE96D2, 0x3028E1B6, 
		0x0DF161B9, 0xBD196726, 0x419BAD80, 0xC0A06EC7, 
		0x5183F241, 0x92DBF034, 0x6FA21EFC, 0x8F32CE4C, 
		0x13E03373, 0x69A7C66D, 0xE56D6493, 0xBF1A2FFA, 
		0xBB1CBFB7, 0x587403B5, 0xE76E2C4F, 0x5D89B796, 
		0xE89C052A, 0x446619A3, 0x342E71FB, 0x0FF22965, 
		0xFE81827A, 0xB11322F1, 0xA30835EC, 0xCD510F7E, 
		0xFF7AA614, 0x5C7293F8, 0x2FC29712, 0xF370E3C3, 
		0x992F491C, 0xD1431568, 0xC2A3261B, 0x88CC32B3, 
		0x8ACF7A6F, 0xB0E8069F, 0x7A47F51E, 0xD2BB79DA, 
		0xE6950821, 0x4398E55C, 0xD0B83106, 0x11E37BAF, 
		0x7E416553, 0xCCAA2B10, 0xD8B4E49C, 0x6456A7D4, 
		0xFB7C3659, 0x724B2084, 0xEA9F4DF6, 0x6A5FAADF, 
		0x2DC1DFCE, 0x70486858, 0xCAAFF381, 0x0605D891, 
		0x5A774B69, 0x94DE28A5, 0x39DF1042, 0x813BC347, 
		0xFC82CAA6, 0x23C8D2C5, 0x03F86CB2, 0x080CD59A, 
		0xDAB7AC40, 0x7DB909E1, 0x3824342C, 0xCF5247A2, 
		0xDCB274D1, 0x63A85B2B, 0x35D55595, 0x479E7511, 
		0x15E5EBE2, 0x4B9430C6, 0x4A6F14A8, 0x91239C86, 
		0x4C6ACC39, 0x5F8AFF4A, 0x0406904D, 0xEE99DDBB, 
		0x1E1152CA, 0xAAFFC418, 0xEB646998, 0x07FEFCFF, 
		0x8B345E01, 0x567D0EBE, 0xBAE79BD9, 0x4263C132, 
		0x75B5DC7B, 0x97264417, 0x67AECB66, 0x95250CCB, 
		0xEC9A9567, 0x57862AD0, 0x60503799, 0xB8E4D305, 
		0x65AD83BA, 0x19EFAE35, 0xA4F6C913, 0xC15B4AA9, 
		0x873E1BD6, 0xA0F0595E, 0x18148A5B, 0xAF02703B, 
		0xAB04E076, 0xDD4950BF, 0xDF4A1863, 0xC6A5B656, 
		0x853D530A, 0xFA871237, 0x77B694A7, 0x4665517F, 
		0xED61B109, 0x1BECE6E9, 0xD5458525, 0xF5753B52, 
		0x7FBA413D, 0x27CE4288, 0xB2EB4E43, 0xD6BDE997, 
		0x527B9EF3, 0x62537F45, 0x2C3AFBA0, 0x7BBCD170, 
		0xB91FF76B, 0x121B171D, 0xFD79EEC8, 0x3A277CF0, 
		0x0C0A45D7, 0x96DD6079, 0x2233F6AB, 0xACFA1C89, 
		0xC8ACBB5D, 0xA10B7D30, 0xD4BEA14B, 0xBEE10B94, 
		0x25CD0A54, 0x547E4662, 0xA2F31182, 0x17E6A33E, 
		0x263566E6, 0xC3580275, 0x83388B9B, 0x7844BDC2, 
		0x020348DC, 0x4F92A08B, 0x2E39B37C, 0x4E6984E5, 
		0xF0888F71, 0x362D3927, 0x9CD2FD3F, 0x01FB246E, 
		0x893716DD, 0x00000000, 0xF68D57E0, 0xE293986C, 
		0x744EF815, 0x9320D45A, 0xAD0138E7, 0xD3405DB4, 
		0x1A17C287, 0xB3106A2D, 0x5078D62F, 0xF48E1F3C, 
		0xA70EA5A1, 0x71B34C36, 0x9AD725AE, 0x5E71DB24, 
		0x161D8750, 0xEF62F9D5, 0x8D318690, 0x1C121A16, 
		0xA6F581CF, 0x5B8C6F07, 0x37D61D49, 0x6E593A92, 
		0x84C67764, 0x86C53FB8, 0xD746CDF9, 0xE090D0B0, 
		0x29C74F83, 0xE49640FD, 0x0E090D0B, 0x6DA15620, 
		0x8EC9EA22, 0xDB4C882E, 0xF776738E, 0xB515B2BC, 
		0x10185FC1, 0x322BA96A, 0x6BA48EB1, 0xAEF95455, 
		0x406089EE, 0x6655EF08, 0xE9672144, 0x3E21ECBD, 
		0x2030BE77, 0xF28BC7AD, 0x80C0E729, 0x141ECF8C, 
		0xBCE24348, 0xC4A6FE8A, 0x31D3C5D8, 0xB716FA60, 
		0x5380BA9D, 0xD94FC0F2, 0x1DE93E78, 0x24362E3A, 
		0xE16BF4DE, 0xCB54D7EF, 0x09F7F1F4, 0x82C3AFF5, 
		0x0BF4B928, 0x9D29D951, 0xC75E9238, 0xF8845AEB, 
		0x90D8B8E8, 0xDEB13C0D, 0x33D08D04, 0x685CE203, 
		0xC55DDAE4, 0x3BDC589E, 0x0A0F9D46, 0x3FDAC8D3, 
		0x598F27DB, 0xA8FC8CC4, 0x79BF99AC, 0x6C5A724E, 
		0x8CCAA2FE, 0x9ED1B5E3, 0x1FEA76A4, 0x73B004EA};

	private static final int BLOCK_SIZE = 16;
	
	/*
	 *	Square's number of rounds.
	 */
	private static final int R = 8;

	/*
	 *	This instance's Square key schedule.
	 */
	private int[][] sKey = new int[R + 1][4];

	private static final int ROOT = 0x1F5;				// for generating GF(2**8)

	private static final byte[][] G = {
		{0x02, 0x01, 0x01, 0x03},
		{0x03, 0x02, 0x01, 0x01},
		{0x01, 0x03, 0x02, 0x01},
		{0x01, 0x01, 0x03, 0x02}
	};
		
	private static final int[] OFFSET = new int[R];


// Static code to build some tables
//............................................................................

	static {
		// generate the OFFSET values
		OFFSET[0] = 1;
		for (int i = 1; i < R; i++) {
			OFFSET[i] = mul(OFFSET[i - 1], 2);
			OFFSET[i - 1] <<= 24;
		}
		OFFSET[R - 1] <<= 24;
	}


// Constructor
//............................................................................

	/**
	 *	Calls the Cipher constructor with <code>implBuffering</code> false,
	 *	<code>implPadding</code> false and the provider set to "Cryptix."
	 *
	 *	@see	java.security.Cipher#Cipher
	 */
	public Square () {
		super(false, false, "Cryptix");
	}


// Implementation of JCE methods
//............................................................................
	
	/**
	 *	<b>SPI</b>: Returns the length of an input block, in bytes.
	 *
	 *	@return the length in bytes of an input block for this cipher.
	 */
	public int engineBlockSize () {
		return BLOCK_SIZE;
	}

	/**
	 *	<b>SPI</b>: Initializes this cipher for encryption, using the
	 *	specified key.
	 *
	 *	@param key	the key to use for encryption.
	 *	@exception	KeyException	when one of the following occurs:<ul>
	 *				<li>The user key object is null;
	 *				<li>The decoded byte array form of the user key is
	 *				zero long;
	 *				<li>The decoded user key is different than 128 bits.</ul>
	 */
	public void engineInitEncrypt (Key key)
	throws KeyException {
		
		byte[] uk = key.getEncoded();
		if (uk == null)
			throw new KeyException("Null Square user key");
		else if (uk.length != 16)
			throw new KeyException("Invalid Square user key size");

		int i, j = 0;
		for (i = 0; i < 4; i++)
			sKey[0][i] = (uk[j++] & 0xFF) << 24 | (uk[j++] & 0xFF) << 16 |
						 (uk[j++] & 0xFF) <<  8 | (uk[j++] & 0xFF);
		for (i = 1; i < R + 1; i++) {
			j = i - 1;
			sKey[i][0] = sKey[j][0] ^ rot32L(sKey[j][3], 8) ^ OFFSET[j];
			sKey[i][1] = sKey[j][1] ^ sKey[i][0];
			sKey[i][2] = sKey[j][2] ^ sKey[i][1];
			sKey[i][3] = sKey[j][3] ^ sKey[i][2];
			
			transform(sKey[j], sKey[j]);
		}	
		state = ENCRYPT;
	}

	/**
	 *	<b>SPI</b>: Initializes this cipher for decryption, using the
	 *	specified key.
	 *
	 *	@param key	the key to use for decryption.
	 *	@exception	KeyException	when one of the following occurs:<ul>
	 *				<li>The user key object is null;
	 *				<li>The decoded byte array form of the user key is
	 *				zero long;
	 *				<li>The decoded user key is different than 128 bits.</ul>
	 */
	public void engineInitDecrypt (Key key)
	throws KeyException {

		byte[] uk = key.getEncoded();
		if (uk == null)
			throw new KeyException("Null Square user key");
		else if (uk.length != 16)
			throw new KeyException("Invalid Square user key size");

		int i, j = 0;
		int[][] tKey = new int[R + 1][4];
		// apply the key evolution function
		for (i = 0; i < 4; i++)
			tKey[0][i] = (uk[j++] & 0xFF) << 24 | (uk[j++] & 0xFF) << 16 |
						 (uk[j++] & 0xFF) <<  8 | (uk[j++] & 0xFF);
		for (i = 1; i < R + 1; i++) {
			j = i - 1;
			tKey[i][0] = tKey[j][0] ^ rot32L(tKey[j][3], 8) ^ OFFSET[j];
			tKey[i][1] = tKey[j][1] ^ tKey[i][0];
			tKey[i][2] = tKey[j][2] ^ tKey[i][1];
			tKey[i][3] = tKey[j][3] ^ tKey[i][2];
		}
		for (i = 0; i < R; i++)
			System.arraycopy(tKey[R - i], 0, sKey[i], 0, 4);

		transform(tKey[0], sKey[R]);

		state = DECRYPT;
	}

	/**
	 *	<code>in</code> and <code>out</code> may be the same array, and the
	 *	input and output regions may overlap but inLen has to be a multiple
	 *	of Square's block size; ie. 16 bytes. If it isn't, then only the first
	 *	(n * 16) bytes are processed.
	 *
	 *	@param in		the input data.
	 *	@param inOff	the offset into <code>in</code> specifying where
	 *		  			the data starts.
	 *	@param inLen	the length of the subarray. It's the responsibility
	 *					of the caller to ensure that inLen = n * 8 bytes.
	 *	@param out		the output array.
	 *	@param outOff	the offset indicating where to start writing into
	 *		  			the <code>out</code> array.
	 *	@return  the number of bytes written.
	 */
	public int engineUpdate (byte[] in, int inOff, int inLen, byte[] out, int outOff) {
		int blockCount = inLen / BLOCK_SIZE;
		byte[] outs = new byte[blockCount * BLOCK_SIZE];
		int outsOff = 0;
		if (state == ENCRYPT)
			for (int i = 0; i < blockCount; i++) {
				square(in, inOff, outs, outsOff, TE, SE);
				inOff += BLOCK_SIZE;
				outsOff += BLOCK_SIZE;
			}
		else
			for (int i = 0; i < blockCount; i++) {
				square(in, inOff, outs, outsOff, TD, SD);
				inOff += BLOCK_SIZE;
				outsOff += BLOCK_SIZE;
			}
		System.arraycopy(outs, 0, out, outOff, outsOff);
		return outsOff;
	}


// Own methods
//............................................................................

	/**
	 *	Applies the Theta function to an input <code>in</code> in order to
	 *	produce in <code>out</code> an internal session sub-key.
	 *	<p>
	 *	Both <code>in</code> and <code>out</code> are arrays of four ints.
	 */
	private static void transform (int[] in, int[] out) {
		int j, k, l, m, n;
		for (int i = 0; i < 4; i++) {
			l = in[i];
			m = 0;
			for (j = 0, n = 24; j < 4; j++, n -= 8) {
				k = (mul(l >>> 24, G[0][j]) & 0xFF) ^
					(mul(l >>> 16, G[1][j]) & 0xFF) ^
					(mul(l >>>  8, G[2][j]) & 0xFF) ^
					(mul(l       , G[3][j]) & 0xFF);
				m ^= (k & 0xFF) << n;
			}
			out[i] = m;
		}
	}

	/**
	 *	Left rotate a 32-bit chunck
	 *
	 *	@param	x	the 32-bit data to rotate
	 *	@param	s	number of places to left-rotate by
	 *	@return	the newly permutetated value.
	 */
	private static int rot32L (int x, int s) {
		return x << s | x >>> (32 - s);
	}

	/**
	 *	Right rotate a 32-bit chunck
	 *
	 *	@param	x	the 32-bit data to rotate
	 *	@param	s	number of places to right-rotate by
	 *	@return	the newly permutetated value.
	 */
	private static int rot32R (int x, int s) {
		return x >>> s | x << (32 - s);
	}

	/**
	 *	Returns the product of two binary numbers a and b, using the generator
	 *	ROOT as the modulus: p = (a * b) mod ROOT. ROOT Generates a suitable
	 *	Galois Field in GF(2 ** 8).
	 *	<p>
	 *	For best performance always call it with abs(b) < abs(a).
	 *
	 *	@param	a	operand for multiply.
	 *	@param	b	operand for multiply.
	 *	@return	the result of (a * b) % ROOT.
	 */
	private static final int mul (int a, int b) {
		if (a == 0)
			return 0;

		a &= 0xFF;
		b &= 0xFF;
		int p = 0;
		while (b != 0) {
			if ((b & 0x01) != 0)
				p ^= a;
			a <<= 1;
			if (a > 0xFF)
				a ^= ROOT;
			b >>>= 1;
		}
		return p;
	}

	/**
	 *	Applies the Square algorithm (for both encryption and decryption since
	 *	it is the same) on a 128-bit plain/cipher text into a same length cipher/
	 *	plain text using the Square formulae, relevant sub-keys, transposition
	 *	and S-Box values.
	 *
	 *	@param	in		contains the plain-text 128-bit block.
	 *	@param	off		start index within input where data is considered.
	 *	@param	out		will contain the cipher-text block.
	 *	@param	outOff	index in out where cipher-text starts.
	 *	@param	T		reference to either the encryption (TE) or decryption
	 *					(TD) transposition vector.
	 *	@param	S		reference to either the encryption (SE) or decryption
	 *					(SD) S-Box values.
	 */
	private void
	square (byte[] in, int off, byte[] out, int outOff, int[] T, byte[] S) {

		int a = (in[off++] & 0xFF) << 24 | (in[off++] & 0xFF) << 16 |
				(in[off++] & 0xFF) <<  8 | (in[off++] & 0xFF);
		int b = (in[off++] & 0xFF) << 24 | (in[off++] & 0xFF) << 16 |
				(in[off++] & 0xFF) <<  8 | (in[off++] & 0xFF);
		int c = (in[off++] & 0xFF) << 24 | (in[off++] & 0xFF) << 16 |
				(in[off++] & 0xFF) <<  8 | (in[off++] & 0xFF);
		int d = (in[off++] & 0xFF) << 24 | (in[off++] & 0xFF) << 16 |
				(in[off++] & 0xFF) <<  8 | (in[off++] & 0xFF);

		int aa, bb, cc, dd;
		int i, j, k;

		a ^= sKey[0][0];
		b ^= sKey[0][1];
		c ^= sKey[0][2];
		d ^= sKey[0][3];

		// R - 1 full rounds
		for (i = 1; i < R; i++) {
			aa =       T[(a >>> 24) & 0xFF]      ^
				rot32R(T[(b >>> 24) & 0xFF],  8) ^
				rot32R(T[(c >>> 24) & 0xFF], 16) ^
				rot32R(T[(d >>> 24) & 0xFF], 24) ^ sKey[i][0];
					
			bb =       T[(a >>> 16) & 0xFF]      ^
				rot32R(T[(b >>> 16) & 0xFF],  8) ^
				rot32R(T[(c >>> 16) & 0xFF], 16) ^
				rot32R(T[(d >>> 16) & 0xFF], 24) ^ sKey[i][1];
					
			cc =       T[(a >>>  8) & 0xFF]      ^
				rot32R(T[(b >>>  8) & 0xFF],  8) ^
				rot32R(T[(c >>>  8) & 0xFF], 16) ^
				rot32R(T[(d >>>  8) & 0xFF], 24) ^ sKey[i][2];
					
			dd =       T[ a         & 0xFF]      ^
				rot32R(T[ b         & 0xFF],  8) ^
				rot32R(T[ c         & 0xFF], 16) ^
				rot32R(T[ d         & 0xFF], 24) ^ sKey[i][3];
					
			a = aa;
			b = bb;
			c = cc;
			d = dd;
		}
		// last round (diffusion becomes only transposition)
		for (i = 0, j = 24; i < 4; i++, j -= 8) {
			k = (S[(a >>> j) & 0xFF] & 0xFF) << 24 |
				(S[(b >>> j) & 0xFF] & 0xFF) << 16 |
				(S[(c >>> j) & 0xFF] & 0xFF) <<  8 |
				(S[(d >>> j) & 0xFF] & 0xFF);
			k ^= sKey[R][i];

			out[outOff++] = (byte)((k >>> 24) & 0xFF);
			out[outOff++] = (byte)((k >>> 16) & 0xFF);
			out[outOff++] = (byte)((k >>>  8) & 0xFF);
			out[outOff++] = (byte)( k         & 0xFF);
		}
	}
}
