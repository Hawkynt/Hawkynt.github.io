
/* Partially optimised Serpent S Box boolean functions derived  */
/* using a recursive descent analyser but without a full search */
/* of all subtrees. The average number of terms per S box is    */
/* just less than 17.                                           */
/*                                                              */
/* Copyright:   Dr B. R Gladman (gladman@seven77.demon.co.uk)   */
/*              30th June 1998                                  */
/*                                                              */
/* I hereby give permission for the information in this file to */
/* be used freely subject only to acknowledgement of its origin */

/* 17 terms */

#define sb0(a,b,c,d,e,f,g,h)                                    \
{   u4byte  t1,t2,t3,t4,t6,t7,t8,t9,t11,t12,t13,t15,t16;        \
    t1 = b ^ d;         \
    t2 = ~t1;           \
    t3 = a | d;         \
    t4 = b ^ c;         \
    h = t3 ^ t4;        \
    t6 = a ^ b;         \
    t7 = a | t4;        \
    t8 = c & t6;        \
    t9 = t2 | t8;       \
    e = t7 ^ t9;        \
    t11 = a ^ h;        \
    t12 = t1 & t6;      \
    t13 = e ^ t11;      \
    f = t12 ^ t13;      \
    t15 = e | f;        \
    t16 = t3 & t15;     \
    g = b ^ t16;        \
}

/* 17 terms */

#define ib0(a,b,c,d,e,f,g,h)                                    \
{   u4byte  t1,t2,t3,t4,t6,t7,t8,t9,t11,t12,t13,t15,t16;        \
    t1 = a ^ d;         \
    t2 = c ^ d;         \
    t3 = ~t2;           \
    t4 = a | b;         \
    g = t3 ^ t4;        \
    t6 = b ^ t1;        \
    t7 = c | t6;        \
    t8 = a ^ t7;        \
    t9 = t2 & t8;       \
    f = t6 ^ t9;        \
    t11 = ~t8;          \
    t12 = b & d;        \
    t13 = f | t12;      \
    h = t11 ^ t13;      \
    t15 = t2 ^ t12;     \
    t16 = f | h;        \
    e = t15 ^ t16;      \
}

/* 18 terms */

#define sb1(a,b,c,d,e,f,g,h)                                    \
{   u4byte  t1,t2,t3,t4,t5,t7,t8,t9,t10,t12,t13,t14,t16,t17;    \
    t1 = a ^ d;         \
    t2 = b ^ d;         \
    t3 = a & b;         \
    t4 = ~c;            \
    t5 = t2 ^ t3;       \
    g = t4 ^ t5;        \
    t7 = a ^ t2;        \
    t8 = b | t4;        \
    t9 = d | g;         \
    t10 = t7 & t9;      \
    f = t8 ^ t10;       \
    t12 = c ^ d;        \
    t13 = t1 | t2;      \
    t14 = f ^ t12;      \
    h = t13 ^ t14;      \
    t16 = t1 | g;       \
    t17 = t8 ^ t14;     \
    e = t16 ^ t17;      \
}

/* 17 terms */

#define ib1(a,b,c,d,e,f,g,h)                                \
{   u4byte  t1,t2,t3,t4,t5,t7,t8,t9,t11,t12,t13,t15,t16;    \
    t1 = a ^ d;         \
    t2 = a & b;         \
    t3 = b ^ c;         \
    t4 = a ^ t3;        \
    t5 = b | d;         \
    h = t4 ^ t5;        \
    t7 = c | t1;        \
    t8 = b ^ t7;        \
    t9 = t4 & t8;       \
    f = t1 ^ t9;        \
    t11 = ~t2;          \
    t12 = h & f;        \
    t13 = t9 ^ t11;     \
    g = t12 ^ t13;      \
    t15 = a & d;        \
    t16 = c ^ t13;      \
    e = t15 ^ t16;      \
}

/* 16 terms */

#define sb2(a,b,c,d,e,f,g,h)                            \
{   u4byte  t1,t2,t3,t5,t6,t7,t9,t10,t11,t13,t14,t15;   \
    t1 = ~a;            \
    t2 = b ^ d;         \
    t3 = c & t1;        \
    e = t2 ^ t3;        \
    t5 = c ^ t1;        \
    t6 = c ^ e;         \
    t7 = b & t6;        \
    h = t5 ^ t7;        \
    t9 = d | t7;        \
    t10 = e | t5;       \
    t11 = t9 & t10;     \
    g = a ^ t11;        \
    t13 = d | t1;       \
    t14 = t2 ^ h;       \
    t15 = g ^ t13;      \
    f = t14 ^ t15;      \
}

/* 16 terms */

#define ib2(a,b,c,d,e,f,g,h)                                    \
{   u4byte  t1,t2,t3,t4,t5,t7,t8,t9,t11,t12,t14,t15;            \
    t1 = b ^ d;         \
    t2 = ~t1;           \
    t3 = a ^ c;         \
    t4 = c ^ t1;        \
    t5 = b & t4;        \
    e = t3 ^ t5;        \
    t7 = a | t2;        \
    t8 = d ^ t7;        \
    t9 = t3 | t8;       \
    h = t1 ^ t9;        \
    t11 = ~t4;          \
    t12 = e | h;        \
    f = t11 ^ t12;      \
    t14 = d & t11;      \
    t15 = t3 ^ t12;     \
    g = t14 ^ t15;      \
}

/* 18 terms */

#define sb3(a,b,c,d,e,f,g,h)                                    \
{   u4byte  t1,t2,t3,t4,t5,t6,t8,t9,t10,t12,t13,t15,t16,t17;    \
    t1 = a ^ c;         \
    t2 = a | d;         \
    t3 = a & b;         \
    t4 = a & d;         \
    t5 = b | t4;        \
    t6 = t1 & t2;       \
    f = t5 ^ t6;        \
    t8 = b ^ d;         \
    t9 = c | t3;        \
    t10 = t6 ^ t8;      \
    h = t9 ^ t10;       \
    t12 = c ^ t3;       \
    t13 = t2 & h;       \
    g = t12 ^ t13;      \
    t15 = ~g;           \
    t16 = t2 ^ t3;      \
    t17 = f & t15;      \
    e = t16 ^ t17;      \
}

/* 17 terms */

#define ib3(a,b,c,d,e,f,g,h)                                    \
{   u4byte  t1,t2,t3,t4,t5,t7,t8,t9,t11,t12,t14,t15,t16;        \
    t1 = b ^ c;         \
    t2 = b | c;         \
    t3 = a ^ c;         \
    t4 = t2 ^ t3;       \
    t5 = d | t4;        \
    e = t1 ^ t5;        \
    t7 = a ^ d;         \
    t8 = t1 | t5;       \
    t9 = t2 ^ t7;       \
    g = t8 ^ t9;        \
    t11 = a & t4;       \
    t12 = e | t9;       \
    f = t11 ^ t12;      \
    t14 = a & g;        \
    t15 = t2 ^ t14;     \
    t16 = e & t15;      \
    h = t4 ^ t16;       \
}

/* 17 terms */

#define sb4(a,b,c,d,e,f,g,h)                                    \
{   u4byte  t1,t2,t3,t4,t5,t7,t8,t10,t11,t12,t14,t15,t16;       \
    t1 = ~a;            \
    t2 = a ^ d;         \
    t3 = a ^ b;         \
    t4 = c ^ t1;        \
    t5 = t2 | t3;       \
    e = t4 ^ t5;        \
    t7 = ~e;            \
    t8 = b | t7;        \
    h = t2 ^ t8;        \
    t10 = a & e;        \
    t11 = b ^ h;        \
    t12 = t8 & t11;     \
    g = t10 ^ t12;      \
    t14 = a | t7;       \
    t15 = t3 ^ t14;     \
    t16 = h & g;        \
    f = t15 ^ t16;      \
}

/* 17 terms */

#define ib4(a,b,c,d,e,f,g,h)                                    \
{   u4byte  t1,t2,t3,t4,t6,t7,t8,t10,t11,t12,t14,t15,t16;       \
    t1 = c ^ d;         \
    t2 = c | d;         \
    t3 = b ^ t2;        \
    t4 = a & t3;        \
    f = t1 ^ t4;        \
    t6 = a ^ d;         \
    t7 = b | d;         \
    t8 = t6 & t7;       \
    h = t3 ^ t8;        \
    t10 = ~a;           \
    t11 = c ^ h;        \
    t12 = t10 | t11;    \
    e = t3 ^ t12;       \
    t14 = c | t4;       \
    t15 = t7 ^ t14;     \
    t16 = h | t10;      \
    g = t15 ^ t16;      \
}

/* 17 terms */

#define sb5(a,b,c,d,e,f,g,h)                                \
{   u4byte  t1,t2,t3,t4,t5,t7,t8,t10,t11,t12,t14,t15,t16;   \
    t1 = ~a;            \
    t2 = a ^ b;         \
    t3 = a ^ d;         \
    t4 = c ^ t1;        \
    t5 = t2 | t3;       \
    e = t4 ^ t5;        \
    t7 = ~d;            \
    t8 = e & t7;        \
    f = t2 ^ t8;        \
    t10 = b | f;        \
    t11 = c | e;        \
    t12 = t7 ^ t10;     \
    h = t11 ^ t12;      \
    t14 = d | f;        \
    t15 = t1 ^ t14;     \
    t16 = e | h;        \
    g = t15 ^ t16;      \
}

/* 16 terms */

#define ib5(a,b,c,d,e,f,g,h)                                \
{   u4byte  t1,t2,t3,t4,t5,t7,t8,t10,t11,t13,t14,t15;       \
    t1 = ~c;            \
    t2 = b & t1;        \
    t3 = d ^ t2;        \
    t4 = a & t3;        \
    t5 = b ^ t1;        \
    h = t4 ^ t5;        \
    t7 = b | h;         \
    t8 = a & t7;        \
    f = t3 ^ t8;        \
    t10 = a | d;        \
    t11 = t1 ^ t7;      \
    e = t10 ^ t11;      \
    t13 = a ^ c;        \
    t14 = b & t10;      \
    t15 = t4 | t13;     \
    g = t14 ^ t15;      \
} 

/* 17 terms */

#define sb6(a,b,c,d,e,f,g,h)                                \
{   u4byte  t1,t2,t3,t4,t5,t7,t8,t9,t11,t12,t13,t15,t16;    \
    t1 = a ^ c;         \
    t2 = b | d;         \
    t3 = b ^ c;         \
    t4 = ~t3;           \
    t5 = a & d;         \
    f = t4 ^ t5;        \
    t7 = b | c;         \
    t8 = d ^ t1;        \
    t9 = t7 & t8;       \
    h = t2 ^ t9;        \
    t11 = t1 & t7;      \
    t12 = t4 ^ t8;      \
    t13 = h & t11;      \
    e = t12 ^ t13;      \
    t15 = t3 ^ t11;     \
    t16 = h | t15;      \
    g = t12 ^ t16;      \
}

/* 17 terms */

#define ib6(a,b,c,d,e,f,g,h)                                \
{   u4byte  t1,t2,t3,t4,t6,t7,t8,t9,t11,t12,t13,t15,t16;    \
    t1 = ~c;            \
    t2 = a ^ c;         \
    t3 = b ^ d;         \
    t4 = a | t1;        \
    f = t3 ^ t4;        \
    t6 = a | b;         \
    t7 = b & t2;        \
    t8 = f ^ t6;        \
    t9 = t7 | t8;       \
    e = c ^ t9;         \
    t11 = ~f;           \
    t12 = d | t2;       \
    t13 = t9 ^ t11;     \
    h = t12 ^ t13;      \
    t15 = b ^ t11;      \
    t16 = e & h;        \
    g = t15 ^ t16;      \
}

/* 17 terms */

#define sb7(a,b,c,d,e,f,g,h)                                \
{   u4byte  t1,t2,t3,t4,t5,t7,t8,t9,t11,t12,t13,t15,t16;    \
    t1 = ~c;            \
    t2 = b ^ c;         \
    t3 = b | t1;        \
    t4 = d ^ t3;        \
    t5 = a & t4;        \
    h = t2 ^ t5;        \
    t7 = a ^ d;         \
    t8 = b ^ t5;        \
    t9 = t2 | t8;       \
    f = t7 ^ t9;        \
    t11 = d & t3;       \
    t12 = t5 ^ f;       \
    t13 = h & t12;      \
    g = t11 ^ t13;      \
    t15 = t1 | t4;      \
    t16 = t12 ^ g;      \
    e = t15 ^ t16;      \
}

/* 17 terms */

#define ib7(a,b,c,d,e,f,g,h)                                \
{   u4byte  t1,t2,t3,t4,t6,t7,t8,t9,t11,t12,t14,t15,t16;    \
    t1 = a & b;         \
    t2 = a | b;         \
    t3 = c | t1;        \
    t4 = d & t2;        \
    h = t3 ^ t4;        \
    t6 = ~d;            \
    t7 = b ^ t4;        \
    t8 = h ^ t6;        \
    t9 = t7 | t8;       \
    f = a ^ t9;         \
    t11 = c ^ t7;       \
    t12 = d | f;        \
    e = t11 ^ t12;      \
    t14 = a & h;        \
    t15 = t3 ^ f;       \
    t16 = e ^ t14;      \
    g = t15 ^ t16;      \
}
