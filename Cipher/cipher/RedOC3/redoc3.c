#include <stdio.h>
#include <stdlib.h>


#define byte unsigned char


union	U_INT
{
	byte		b_int[2];
	int		i_int;
};

int	i;

byte	key_table[2560];
byte	mask_table[16];

byte	key_length	=	6;
byte 	master_key[70]	=	{89, 66, 128, 231, 18, 43};

byte	the_data[8];

byte	initialize_key_table ()
{
  int		data_point, pi, pii;
  union		U_INT	seed, data_value;
  unsigned int	prime[35] 	=	{  1,   3,   5,   7,  11,  13,  17,
					  19,  23,  29,  31,  37,  41,  43,
					  47,  53,  59,  61,  67,  71,  73,
					  79,  83,  89,  97, 101, 103, 107,
					 109, 113, 127, 131, 137, 139, 149};

  for (pi = 1; pi <= key_length; ++pi)
  {
    if (pi != key_length)
    {   seed.b_int[0] = master_key[pi-1];
	seed.b_int[1] = master_key[pi];
    }
     else
    {   seed.b_int[0] = master_key[pi-1];
	seed.b_int[1] = master_key[0];
    }

    srand (seed.i_int);
    data_point = 0;
    
    for (pii = 0; pii < 2560; ++pii)
    { data_point += prime[pi];
      if (data_point > 2559) data_point -= 2560;

      data_value.i_int = rand ();

      key_table[data_point] = data_value.b_int[0];
      if ( (data_point + 1) != 2559)
	key_table[data_point + 1] = data_value.b_int[1];
       else
	key_table[0] = data_value.b_int[1];
    }

  }

  return (0);
}

byte	create_mask_table ()
{
  int	pi, mask_counter;
  byte	*mask_pointer;

  mask_pointer = mask_table;
  mask_counter = 0;

  for (pi = 0; pi < 16; ++pi) mask_table[pi] = 0;

  for (pi = 0; pi < 2560; ++pi)
  { *mask_pointer ^= key_table[pi];
    ++mask_pointer;
    ++mask_counter;
    if (mask_counter == 16)
      {  mask_counter = 0;
	 mask_pointer = mask_table;
      }
  }

  return (0);
}



byte encrypt_data (data)
  byte *data;
{
  int	pi, pii, key_value;
  byte	*mask_point, *data_point, *valu_point;

  valu_point = data;
  mask_point = mask_table;

  for (pi = 0; pi < 8; ++pi)
  {  key_value = *valu_point ^ *mask_point;
     key_value *= 8;
     ++valu_point;
     ++mask_point;

     data_point = data;
     for (pii = 0; pii < 8; ++pii)
     { if (pi != pii) *data_point ^= key_table[key_value + pii];
       ++data_point;
     }
  }


  valu_point = data;

  for (pi = 0; pi < 8; ++pi)
  {
     key_value = *valu_point ^ *mask_point;
     key_value *= 8;
     ++valu_point;
     ++mask_point;

     data_point = data;
     for (pii = 0; pii < 8; ++pii)
     { if (pi != pii) *data_point ^= key_table[key_value + pii];
       ++data_point;
     }
  }

  return (0);
}

byte decrypt_data (data)
  byte *data;
{
  int	pi, pii, key_value;
  byte	*mask_point, *data_point, *valu_point;

  valu_point = data+7;
  mask_point = mask_table+15;

  for (pi = 7; pi >= 0; --pi)
  {  key_value = *valu_point ^ *mask_point;
     key_value *= 8;
     --valu_point;
     --mask_point;

     data_point = data;
     for (pii = 0; pii < 8; ++pii)
     { if (pi != pii) *data_point ^= key_table[key_value + pii];
       ++data_point;
     }
  }

  valu_point = data + 7;

  for (pi = 7; pi >= 0; --pi)
  {  key_value = *valu_point ^ *mask_point;
     key_value *= 8;
     --valu_point;
     --mask_point;

     data_point = data;
     for (pii = 0; pii < 8; ++pii)
     { if (pi != pii) *data_point ^= key_table[key_value + pii];
       ++data_point;
     }
  }

  return (0);
}



byte	main ()
{
  initialize_key_table ();
  create_mask_table ();


  encrypt_data (the_data);
  decrypt_data (the_data);

  return (0);
}
