;(function(global) {
  'use strict';

  const SZ = global.SZ = global.SZ || {};
  SZ.System = SZ.System || {};
  SZ.System.Drawing = SZ.System.Drawing || {};
  const Drawing = SZ.System.Drawing;
  const Bitmap = Drawing.Bitmap;

  const QUANTIZER_OPTIONS = [
    { id: 'MedianCut', name: 'Median Cut' },
    { id: 'Wu', name: 'Wu' },
    { id: 'Octree', name: 'Octree' },
    { id: 'EnhancedOctree', name: 'Enhanced Octree' },
    { id: 'VarianceCut', name: 'Variance Cut' },
    { id: 'VarianceBased', name: 'Variance Based' },
    { id: 'BinarySplitting', name: 'Binary Splitting' },
    { id: 'Popularity', name: 'Popularity' },
    { id: 'Uniform', name: 'Uniform' },
    { id: 'KMeans', name: 'K-Means' },
    { id: 'IncrementalKMeans', name: 'Incremental K-Means' },
    { id: 'BisectingKMeans', name: 'Bisecting K-Means' },
    { id: 'FuzzyCMeans', name: 'Fuzzy C-Means' },
    { id: 'GeneticCMeans', name: 'Genetic C-Means' },
    { id: 'GaussianMixture', name: 'Gaussian Mixture' },
    { id: 'HierarchicalCL', name: 'Hierarchical CL' },
    { id: 'NeuQuant', name: 'NeuQuant' },
    { id: 'ColorQuantizationNetwork', name: 'Color Quantization Network' },
    { id: 'OctreeSOM', name: 'Octree-SOM' },
    { id: 'PngQuant', name: 'PngQuant' },
    { id: 'PcaPreprocessor', name: 'PCA Preprocessor' },
    { id: 'KMeansRefinement', name: 'K-Means Refinement' },
    { id: 'BitReduction', name: 'Bit Reduction' },
    { id: 'AcoRefinement', name: 'ACO Refinement' },
    { id: 'Adu', name: 'ADU' },
    { id: 'Huffman', name: 'Huffman' },
    { id: 'SpatialColor', name: 'Spatial Color' },
    { id: 'WebSafe', name: 'Web Safe' },
    { id: 'EGA16', name: 'EGA 16' },
    { id: 'VGA256', name: 'VGA 256' },
    { id: 'Mac8Bit', name: 'Mac 8-Bit' },
    { id: 'Monochrome', name: 'Monochrome' },
    { id: 'Grayscale', name: 'Grayscale' },
    { id: 'Custom', name: 'Custom' },
    { id: 'CGA4_Palette0Low', name: 'CGA4 Palette0 Low' },
    { id: 'CGA4_Palette0High', name: 'CGA4 Palette0 High' },
    { id: 'CGA4_Palette1Low', name: 'CGA4 Palette1 Low' },
    { id: 'CGA4_Palette1High', name: 'CGA4 Palette1 High' },
    { id: 'CGA4_Palette2Low', name: 'CGA4 Palette2 Low' },
    { id: 'CGA4_Palette2High', name: 'CGA4 Palette2 High' },
    { id: 'CGAComposite16_Default', name: 'CGA Composite 16' },
    { id: 'keep', name: 'Keep Existing Palette' }
  ];

  const DITHER_OPTIONS = [
    { id: 'NoDithering_Instance', name: 'No Dithering' },
    { id: 'ErrorDiffusion_FloydSteinberg', name: 'ErrorDiffusion FloydSteinberg' },
    { id: 'ErrorDiffusion_EqualFloydSteinberg', name: 'ErrorDiffusion EqualFloydSteinberg' },
    { id: 'ErrorDiffusion_FalseFloydSteinberg', name: 'ErrorDiffusion FalseFloydSteinberg' },
    { id: 'ErrorDiffusion_Simple', name: 'ErrorDiffusion Simple' },
    { id: 'ErrorDiffusion_JarvisJudiceNinke', name: 'ErrorDiffusion JarvisJudiceNinke' },
    { id: 'ErrorDiffusion_Stucki', name: 'ErrorDiffusion Stucki' },
    { id: 'ErrorDiffusion_Atkinson', name: 'ErrorDiffusion Atkinson' },
    { id: 'ErrorDiffusion_Burkes', name: 'ErrorDiffusion Burkes' },
    { id: 'ErrorDiffusion_Sierra', name: 'ErrorDiffusion Sierra' },
    { id: 'ErrorDiffusion_TwoRowSierra', name: 'ErrorDiffusion TwoRowSierra' },
    { id: 'ErrorDiffusion_SierraLite', name: 'ErrorDiffusion SierraLite' },
    { id: 'ErrorDiffusion_StevensonArce', name: 'ErrorDiffusion StevensonArce' },
    { id: 'ErrorDiffusion_Pigeon', name: 'ErrorDiffusion Pigeon' },
    { id: 'ErrorDiffusion_ShiauFan', name: 'ErrorDiffusion ShiauFan' },
    { id: 'ErrorDiffusion_ShiauFan2', name: 'ErrorDiffusion ShiauFan2' },
    { id: 'ErrorDiffusion_Fan93', name: 'ErrorDiffusion Fan93' },
    { id: 'ErrorDiffusion_TwoD', name: 'ErrorDiffusion TwoD' },
    { id: 'ErrorDiffusion_Down', name: 'ErrorDiffusion Down' },
    { id: 'ErrorDiffusion_DoubleDown', name: 'ErrorDiffusion DoubleDown' },
    { id: 'ErrorDiffusion_Diagonal', name: 'ErrorDiffusion Diagonal' },
    { id: 'ErrorDiffusion_VerticalDiamond', name: 'ErrorDiffusion VerticalDiamond' },
    { id: 'ErrorDiffusion_HorizontalDiamond', name: 'ErrorDiffusion HorizontalDiamond' },
    { id: 'ErrorDiffusion_Diamond', name: 'ErrorDiffusion Diamond' },
    { id: 'ErrorDiffusionSerpentine_Default', name: 'ErrorDiffusionSerpentine Default' },
    { id: 'Ordered_Bayer2x2', name: 'Ordered Bayer2x2' },
    { id: 'Ordered_Bayer4x4', name: 'Ordered Bayer4x4' },
    { id: 'Ordered_Bayer8x8', name: 'Ordered Bayer8x8' },
    { id: 'Ordered_Bayer16x16', name: 'Ordered Bayer16x16' },
    { id: 'Ordered_Halftone4x4', name: 'Ordered Halftone4x4' },
    { id: 'Ordered_Halftone8x8', name: 'Ordered Halftone8x8' },
    { id: 'Ordered_ClusterDot4x4', name: 'Ordered ClusterDot4x4' },
    { id: 'Ordered_ClusterDot8x8', name: 'Ordered ClusterDot8x8' },
    { id: 'Ordered_Diagonal4x4', name: 'Ordered Diagonal4x4' },
    { id: 'Barycentric_Bayer2x2', name: 'Barycentric Bayer2x2' },
    { id: 'Barycentric_Bayer4x4', name: 'Barycentric Bayer4x4' },
    { id: 'Barycentric_Bayer8x8', name: 'Barycentric Bayer8x8' },
    { id: 'NaturalNeighbour_Bayer2x2', name: 'NaturalNeighbour Bayer2x2' },
    { id: 'NaturalNeighbour_Bayer4x4', name: 'NaturalNeighbour Bayer4x4' },
    { id: 'NaturalNeighbour_Bayer8x8', name: 'NaturalNeighbour Bayer8x8' },
    { id: 'Tin_Bayer2x2', name: 'TIN Bayer2x2' },
    { id: 'Tin_Bayer4x4', name: 'TIN Bayer4x4' },
    { id: 'Tin_Bayer8x8', name: 'TIN Bayer8x8' },
    { id: 'Knoll_Default', name: 'Knoll Default' },
    { id: 'Knoll_Bayer8x8', name: 'Knoll Bayer8x8' },
    { id: 'Knoll_HighQuality', name: 'Knoll HighQuality' },
    { id: 'Knoll_Fast', name: 'Knoll Fast' },
    { id: 'ClusterDot_ClusterDot3x3', name: 'ClusterDot 3x3' },
    { id: 'ClusterDot_ClusterDot4x4', name: 'ClusterDot 4x4' },
    { id: 'ClusterDot_ClusterDot8x8', name: 'ClusterDot 8x8' },
    { id: 'ClusterDot_Default', name: 'ClusterDot Default' },
    { id: 'Average_Default', name: 'Average Default' },
    { id: 'Average_Fine', name: 'Average Fine' },
    { id: 'Average_Coarse', name: 'Average Coarse' },
    { id: 'Adaptive_QualityOptimized', name: 'Adaptive QualityOptimized' },
    { id: 'Adaptive_Balanced', name: 'Adaptive Balanced' },
    { id: 'Adaptive_PerformanceOptimized', name: 'Adaptive PerformanceOptimized' },
    { id: 'Adaptive_SmartSelection', name: 'Adaptive SmartSelection' },
    { id: 'Random_Instance', name: 'Random Instance' },
    { id: 'Random_Light', name: 'Random Light' },
    { id: 'Random_Strong', name: 'Random Strong' },
    { id: 'InterleavedGradientNoise_Instance', name: 'InterleavedGradientNoise Instance' },
    { id: 'InterleavedGradientNoise_Light', name: 'InterleavedGradientNoise Light' },
    { id: 'InterleavedGradientNoise_Strong', name: 'InterleavedGradientNoise Strong' },
    { id: 'XorY149_Default', name: 'XorY149 Default' },
    { id: 'XorY149_WithChannel', name: 'XorY149 WithChannel' },
    { id: 'XYArithmetic_Default', name: 'XYArithmetic Default' },
    { id: 'XYArithmetic_WithChannel', name: 'XYArithmetic WithChannel' },
    { id: 'Uniform_Default', name: 'Uniform Default' },
    { id: 'Ostromoukhov_Instance', name: 'Ostromoukhov Instance' },
    { id: 'Ostromoukhov_Linear', name: 'Ostromoukhov Linear' },
    { id: 'BlueNoise_Size8x8', name: 'BlueNoise Size8x8' },
    { id: 'BlueNoise_Size64x64', name: 'BlueNoise Size64x64' },
    { id: 'BlueNoise_Size128x128', name: 'BlueNoise Size128x128' },
    { id: 'VoidAndCluster_Size4x4', name: 'VoidAndCluster Size4x4' },
    { id: 'VoidAndCluster_Size8x8', name: 'VoidAndCluster Size8x8' },
    { id: 'VoidAndCluster_Size16x16', name: 'VoidAndCluster Size16x16' },
    { id: 'VoidAndCluster_Size32x32', name: 'VoidAndCluster Size32x32' },
    { id: 'Yliluoma_Algorithm1', name: 'Yliluoma Algorithm1' },
    { id: 'Yliluoma_Algorithm2', name: 'Yliluoma Algorithm2' },
    { id: 'Yliluoma_Algorithm3', name: 'Yliluoma Algorithm3' },
    { id: 'Yliluoma_Algorithm3Full', name: 'Yliluoma Algorithm3Full' },
    { id: 'Riemersma_Default', name: 'Riemersma Default' },
    { id: 'Riemersma_Small', name: 'Riemersma Small' },
    { id: 'Riemersma_Large', name: 'Riemersma Large' },
    { id: 'Riemersma_LinearScan', name: 'Riemersma LinearScan' },
    { id: 'Riemersma_Peano', name: 'Riemersma Peano' },
    { id: 'Dbs_Fast', name: 'DBS Fast' },
    { id: 'Dbs_Balanced', name: 'DBS Balanced' },
    { id: 'Dbs_Quality', name: 'DBS Quality' },
    { id: 'Dbs_Best', name: 'DBS Best' },
    { id: 'NClosest_Default', name: 'NClosest Default' },
    { id: 'NClosest_WeightedRandom5', name: 'NClosest WeightedRandom5' },
    { id: 'NClosest_RoundRobin4', name: 'NClosest RoundRobin4' },
    { id: 'NClosest_Luminance6', name: 'NClosest Luminance6' },
    { id: 'NClosest_BlueNoise4', name: 'NClosest BlueNoise4' },
    { id: 'NConvex_Default', name: 'NConvex Default' },
    { id: 'NConvex_Projection6', name: 'NConvex Projection6' },
    { id: 'NConvex_SpatialPattern3', name: 'NConvex SpatialPattern3' },
    { id: 'NConvex_WeightedRandom5', name: 'NConvex WeightedRandom5' },
    { id: 'Noise_WhiteNoise', name: 'Noise WhiteNoise' },
    { id: 'Noise_BlueNoise', name: 'Noise BlueNoise' },
    { id: 'Noise_PinkNoise', name: 'Noise PinkNoise' },
    { id: 'Noise_BrownNoise', name: 'Noise BrownNoise' },
    { id: 'Noise_VioletNoise', name: 'Noise VioletNoise' },
    { id: 'Noise_GreyNoise', name: 'Noise GreyNoise' },
    { id: 'Dizzy_Default', name: 'Dizzy Default' },
    { id: 'Dizzy_HighQuality', name: 'Dizzy HighQuality' },
    { id: 'Dizzy_Fast', name: 'Dizzy Fast' },
    { id: 'Debanding_Default', name: 'Debanding Default' },
    { id: 'Debanding_Strong', name: 'Debanding Strong' },
    { id: 'Debanding_Gentle', name: 'Debanding Gentle' },
    { id: 'GradientAware_Default', name: 'GradientAware Default' },
    { id: 'GradientAware_Soft', name: 'GradientAware Soft' },
    { id: 'GradientAware_Strong', name: 'GradientAware Strong' },
    { id: 'AdaptiveMatrix_Default', name: 'AdaptiveMatrix Default' },
    { id: 'AdaptiveMatrix_Aggressive', name: 'AdaptiveMatrix Aggressive' },
    { id: 'AdaptiveMatrix_Conservative', name: 'AdaptiveMatrix Conservative' },
    { id: 'StructureAware_Default', name: 'StructureAware Default' },
    { id: 'StructureAware_Priority', name: 'StructureAware Priority' },
    { id: 'StructureAware_Large', name: 'StructureAware Large' },
    { id: 'Smart_Default', name: 'Smart Default' },
    { id: 'Smart_HighQuality', name: 'Smart HighQuality' },
    { id: 'Smart_Fast', name: 'Smart Fast' }
  ];

  const QUANTIZER_ALIASES = {
    'median-cut': 'MedianCut',
    mediancut: 'MedianCut',
    wu: 'Wu',
    octree: 'Octree',
    enhancedoctree: 'EnhancedOctree',
    variance: 'VarianceCut',
    variancecut: 'VarianceCut',
    variancebased: 'VarianceBased',
    binarysplitting: 'BinarySplitting',
    popularity: 'Popularity',
    uniform: 'Uniform',
    kmeans: 'KMeans',
    incrementalkmeans: 'IncrementalKMeans',
    bisectingkmeans: 'BisectingKMeans',
    fuzzycmeans: 'FuzzyCMeans',
    geneticcmeans: 'GeneticCMeans',
    gaussianmixture: 'GaussianMixture',
    'hierarchical cl': 'HierarchicalCL',
    hierarchicalcl: 'HierarchicalCL',
    neuquant: 'NeuQuant',
    colorquantizationnetwork: 'ColorQuantizationNetwork',
    octreesom: 'OctreeSOM',
    pngquant: 'PngQuant',
    pcapreprocessor: 'PcaPreprocessor',
    kmeansrefinement: 'KMeansRefinement',
    bitreduction: 'BitReduction',
    acorefinement: 'AcoRefinement',
    adu: 'Adu',
    huffman: 'Huffman',
    spatialcolor: 'SpatialColor',
    websafe: 'WebSafe',
    keep: 'keep'
  };

  const ERROR_DIFFUSION = {
    'floyd-steinberg': { divisor: 16, data: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
    'equal-floyd-steinberg': { divisor: 16, data: [[1, 0, 4], [-1, 1, 4], [0, 1, 4], [1, 1, 4]] },
    'false-floyd-steinberg': { divisor: 8, data: [[1, 0, 3], [0, 1, 3], [1, 1, 2]] },
    simple: { divisor: 1, data: [[1, 0, 1]] },
    'jarvis-judice-ninke': { divisor: 48, data: [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]] },
    stucki: { divisor: 42, data: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]] },
    burkes: { divisor: 32, data: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]] },
    sierra: { divisor: 32, data: [[1, 0, 5], [2, 0, 3], [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2], [-1, 2, 2], [0, 2, 3], [1, 2, 2]] },
    'two-row-sierra': { divisor: 16, data: [[1, 0, 4], [2, 0, 3], [-2, 1, 1], [-1, 1, 2], [0, 1, 3], [1, 1, 2], [2, 1, 1]] },
    'sierra-lite': { divisor: 4, data: [[1, 0, 2], [-1, 1, 1], [0, 1, 1]] },
    atkinson: { divisor: 8, data: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
    'stevenson-arce': { divisor: 200, data: [[2, 0, 32], [-3, 1, 12], [-1, 1, 26], [1, 1, 30], [3, 1, 16], [-2, 2, 12], [0, 2, 26], [2, 2, 12], [-3, 3, 5], [-1, 3, 12], [1, 3, 12], [3, 3, 5]] },
    pigeon: { divisor: 10, data: [[1, 0, 2], [2, 0, 1], [-1, 1, 2], [0, 1, 2], [1, 1, 2], [-2, 2, 1], [0, 2, 1], [2, 2, 1]] },
    'shiau-fan': { divisor: 16, data: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 1], [1, 1, 1]] },
    'shiau-fan-2': { divisor: 8, data: [[1, 0, 4], [2, 0, 2], [-1, 1, 1], [0, 1, 1]] }
    ,fan93: { divisor: 16, data: [[1, 0, 7], [-1, 1, 1], [0, 1, 3], [1, 1, 5]] }
    ,twod: { divisor: 2, data: [[1, 0, 1], [-1, 1, 1]] }
    ,down: { divisor: 1, data: [[0, 1, 1]] }
    ,'double-down': { divisor: 4, data: [[-1, 1, 2], [-1, 2, 1], [0, 2, 1]] }
    ,diagonal: { divisor: 1, data: [[1, 1, 1]] }
    ,'vertical-diamond': { divisor: 16, data: [[-1, 1, 3], [0, 1, 6], [1, 1, 3], [-2, 2, 1], [0, 2, 2], [2, 2, 1]] }
    ,'horizontal-diamond': { divisor: 12, data: [[1, 0, 6], [2, 0, 2], [1, 1, 3], [2, 2, 1]] }
    ,diamond: { divisor: 24, data: [[1, 0, 6], [2, 0, 2], [-1, 1, 3], [0, 1, 6], [1, 1, 3], [-2, 2, 1], [0, 2, 2], [2, 2, 1]] }
  };

  const ORDERED_MATRICES = {
    bayer2: { matrix: [[0, 2], [3, 1]], strength: 40 },
    bayer4: { matrix: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], strength: 48 },
    bayer8: {
      matrix: [
        [0, 48, 12, 60, 3, 51, 15, 63], [32, 16, 44, 28, 35, 19, 47, 31], [8, 56, 4, 52, 11, 59, 7, 55], [40, 24, 36, 20, 43, 27, 39, 23],
        [2, 50, 14, 62, 1, 49, 13, 61], [34, 18, 46, 30, 33, 17, 45, 29], [10, 58, 6, 54, 9, 57, 5, 53], [42, 26, 38, 22, 41, 25, 37, 21]
      ],
      strength: 48
    },
    bayer16: { matrix: null, strength: 48 },
    'cluster-dot-4': { matrix: [[12, 5, 6, 13], [4, 0, 1, 7], [11, 3, 2, 8], [15, 10, 9, 14]], strength: 52 },
    'cluster-dot-8': {
      matrix: [
        [24, 10, 12, 26, 35, 47, 49, 37], [8, 0, 2, 14, 45, 59, 61, 51], [22, 6, 4, 16, 43, 57, 63, 53], [30, 20, 18, 28, 33, 41, 55, 39],
        [34, 46, 48, 36, 25, 11, 13, 27], [44, 58, 60, 50, 9, 1, 3, 15], [42, 56, 62, 52, 23, 7, 5, 17], [32, 40, 54, 38, 31, 21, 19, 29]
      ],
      strength: 52
    },
    'halftone-8': {
      matrix: [
        [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]
      ],
      strength: 44
    },
    'halftone-4': {
      matrix: [
        [7, 13, 11, 4],
        [12, 16, 14, 8],
        [10, 15, 6, 2],
        [5, 9, 3, 1]
      ],
      strength: 44
    },
    'diagonal-4': { matrix: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], strength: 48 }
  };

  const DITHER_ALIASES = {
    none: 'none',
    nodithering: 'none',
    nodithering_instance: 'none',
    'no dithering': 'none',
    random: 'random',
    random_instance: 'random',
    random_light: 'random-light',
    random_strong: 'random-strong',
    interleavedgradientnoise_instance: 'ign',
    interleavedgradientnoise_light: 'ign-light',
    interleavedgradientnoise_strong: 'ign-strong',
    xory149_default: 'arith-xory149',
    xory149_withchannel: 'arith-xory149-ch',
    xyarithmetic_default: 'arith-xy',
    xyarithmetic_withchannel: 'arith-xy-ch',
    uniform_default: 'arith-uniform',
    ostromoukhov_instance: 'ostromoukhov',
    ostromoukhov_linear: 'ostromoukhov-linear',
    bluenoise_size8x8: 'blue-noise-8',
    bluenoise_size64x64: 'blue-noise-64',
    bluenoise_size128x128: 'blue-noise-128',
    voidandcluster_size4x4: 'void-cluster-4',
    voidandcluster_size8x8: 'void-cluster-8',
    voidandcluster_size16x16: 'void-cluster-16',
    voidandcluster_size32x32: 'void-cluster-32',
    yliluoma_algorithm1: 'yliluoma-1',
    yliluoma_algorithm2: 'yliluoma-2',
    yliluoma_algorithm3: 'yliluoma-3',
    yliluoma_algorithm3full: 'yliluoma-4',
    riemersma_default: 'riemersma-hilbert-16',
    riemersma_small: 'riemersma-hilbert-8',
    riemersma_large: 'riemersma-hilbert-32',
    riemersma_linearscan: 'riemersma-linear-16',
    riemersma_peano: 'riemersma-peano-16',
    dbs_fast: 'dbs-1',
    dbs_balanced: 'dbs-3',
    dbs_quality: 'dbs-5',
    dbs_best: 'dbs-10',
    nclosest_default: 'nclosest-default',
    nclosest_weightedrandom5: 'nclosest-weighted',
    nclosest_roundrobin4: 'nclosest-roundrobin',
    nclosest_luminance6: 'nclosest-luminance',
    nclosest_bluenoise4: 'nclosest-bluenoise',
    nconvex_default: 'nconvex-default',
    nconvex_projection6: 'nconvex-projection',
    nconvex_spatialpattern3: 'nconvex-spatial',
    nconvex_weightedrandom5: 'nconvex-weighted',
    noise_whitenoise: 'noise-white',
    noise_bluenoise: 'noise-blue',
    noise_pinknoise: 'noise-pink',
    noise_brownnoise: 'noise-brown',
    noise_violetnoise: 'noise-violet',
    noise_greynoise: 'noise-grey',
    dizzy_default: 'dizzy-default',
    dizzy_highquality: 'dizzy-hq',
    dizzy_fast: 'dizzy-fast',
    debanding_default: 'debanding-default',
    debanding_strong: 'debanding-strong',
    debanding_gentle: 'debanding-gentle',
    gradientaware_default: 'gradient-aware-default',
    gradientaware_soft: 'gradient-aware-soft',
    gradientaware_strong: 'gradient-aware-strong',
    adaptivematrix_default: 'adaptive-matrix-default',
    adaptivematrix_aggressive: 'adaptive-matrix-aggressive',
    adaptivematrix_conservative: 'adaptive-matrix-conservative',
    adaptive_qualityoptimized: 'adaptive-quality',
    adaptive_balanced: 'adaptive-balanced',
    adaptive_performanceoptimized: 'adaptive-fast',
    adaptive_smartselection: 'adaptive-smart',
    structureaware_default: 'structure-aware-default',
    structureaware_priority: 'structure-aware-priority',
    structureaware_large: 'structure-aware-large',
    smart_default: 'smart-default',
    smart_highquality: 'smart-hq',
    smart_fast: 'smart-fast',

    ordered_bayer2x2: 'bayer2',
    ordered_bayer4x4: 'bayer4',
    ordered_bayer8x8: 'bayer8',
    ordered_bayer16x16: 'bayer16',
    ordered_halftone4x4: 'halftone-4',
    ordered_halftone8x8: 'halftone-8',
    ordered_clusterdot4x4: 'cluster-dot-4',
    ordered_clusterdot8x8: 'cluster-dot-8',
    ordered_diagonal4x4: 'diagonal-4',
    barycentric_bayer2x2: 'bayer2',
    barycentric_bayer4x4: 'bayer4',
    barycentric_bayer8x8: 'bayer8',
    naturalneighbour_bayer2x2: 'bayer2',
    naturalneighbour_bayer4x4: 'bayer4',
    naturalneighbour_bayer8x8: 'bayer8',
    tin_bayer2x2: 'bayer2',
    tin_bayer4x4: 'bayer4',
    tin_bayer8x8: 'bayer8',
    knoll_default: 'bayer4',
    knoll_bayer8x8: 'bayer8',
    knoll_highquality: 'bayer8',
    knoll_fast: 'bayer2',
    clusterdot_clusterdot3x3: 'cluster-dot-4',
    clusterdot_clusterdot4x4: 'cluster-dot-4',
    clusterdot_clusterdot8x8: 'cluster-dot-8',
    clusterdot_default: 'cluster-dot-4',
    average_default: 'sierra',
    average_fine: 'floyd-steinberg',
    average_coarse: 'halftone-8',

    errordiffusion_floydsteinberg: 'floyd-steinberg',
    errordiffusion_equalfloydsteinberg: 'equal-floyd-steinberg',
    errordiffusion_falsefloydsteinberg: 'false-floyd-steinberg',
    errordiffusion_simple: 'simple',
    errordiffusion_jarvisjudiceninke: 'jarvis-judice-ninke',
    errordiffusion_stucki: 'stucki',
    errordiffusion_atkinson: 'atkinson',
    errordiffusion_burkes: 'burkes',
    errordiffusion_sierra: 'sierra',
    errordiffusion_tworowsierra: 'two-row-sierra',
    errordiffusion_sierralite: 'sierra-lite',
    errordiffusion_stevensonarce: 'stevenson-arce',
    errordiffusion_pigeon: 'pigeon',
    errordiffusion_shiaufan: 'shiau-fan',
    errordiffusion_shiaufan2: 'shiau-fan-2',
    errordiffusion_fan93: 'fan93',
    errordiffusion_twod: 'twod',
    errordiffusion_down: 'down',
    errordiffusion_doubledown: 'double-down',
    errordiffusion_diagonal: 'diagonal',
    errordiffusion_verticaldiamond: 'vertical-diamond',
    errordiffusion_horizontaldiamond: 'horizontal-diamond',
    errordiffusion_diamond: 'diamond',
    errordiffusionserpentine_default: 'floyd-steinberg',

    floydsteinberg: 'floyd-steinberg',
    equalfloydsteinberg: 'equal-floyd-steinberg',
    falsefloydsteinberg: 'false-floyd-steinberg',
    jarvisjudiceninke: 'jarvis-judice-ninke',
    tworowsierra: 'two-row-sierra',
    sierralite: 'sierra-lite',
    stevensonarce: 'stevenson-arce',
    shiaufan: 'shiau-fan',
    shiaufan2: 'shiau-fan-2'
  };

  function normalizeId(s) {
    return String(s || '').trim().toLowerCase().replace(/[\s\-]+/g, '').replace(/[^a-z0-9_]/g, '');
  }

  function resolveQuantizer(id) {
    if (!id)
      return 'MedianCut';
    if (QUANTIZER_ALIASES[id])
      return QUANTIZER_ALIASES[id];
    const n = normalizeId(id);
    return QUANTIZER_ALIASES[n] || id;
  }

  function resolveDither(id) {
    if (!id)
      return 'none';
    if (DITHER_ALIASES[id])
      return DITHER_ALIASES[id];
    const n = normalizeId(id);
    return DITHER_ALIASES[n] || id;
  }

  function clamp8(v) {
    return v < 0 ? 0 : (v > 255 ? 255 : (v | 0));
  }

  function ensureBitmap(source) {
    if (!source)
      return null;
    if (Bitmap && source instanceof Bitmap)
      return source;
    if (Bitmap && source.imageData)
      return Bitmap.fromImageData(source.imageData);
    if (Bitmap && source.data && typeof source.width === 'number' && typeof source.height === 'number')
      return Bitmap.from(source);
    return null;
  }

  function toImageData(source) {
    if (!source)
      return null;
    if (source.data instanceof Uint8ClampedArray && typeof source.width === 'number' && typeof source.height === 'number' && !source.pixelFormat)
      return source;
    const bmp = ensureBitmap(source);
    if (bmp)
      return bmp.toImageData();
    return null;
  }

  function countDistinctOpaqueColors(imageLike, limit = 4096) {
    const bmp = ensureBitmap(imageLike);
    if (bmp)
      return bmp.countDistinctOpaqueColors(limit);
    const img = toImageData(imageLike);
    if (!img)
      return 0;
    const seen = new Set();
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128)
        continue;
      seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      if (seen.size > limit)
        return seen.size;
    }
    return seen.size;
  }

  function nearestPaletteIndex(palette, r, g, b, a) {
    if (Bitmap && Bitmap.nearestPaletteIndex)
      return Bitmap.nearestPaletteIndex(palette, r, g, b, a);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < palette.length; ++i) {
      const p = palette[i];
      const dr = r - p[0], dg = g - p[1], db = b - p[2], da = a - (p[3] == null ? 255 : p[3]);
      const d = dr * dr + dg * dg + db * db + da * da;
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    return best;
  }

  function collectOpaquePixels(imageLike, maxSamples = 65536) {
    const bmp = ensureBitmap(imageLike);
    if (bmp)
      return bmp.sampleOpaquePixels(maxSamples);
    const img = toImageData(imageLike);
    if (!img)
      return [];
    const d = img.data;
    const pixelCount = d.length >> 2;
    const step = Math.max(1, Math.ceil(pixelCount / maxSamples));
    const out = [];
    for (let p = 0; p < pixelCount; p += step) {
      const i = p << 2;
      if (d[i + 3] < 128)
        continue;
      out.push([d[i], d[i + 1], d[i + 2]]);
    }
    return out;
  }

  function normalizePalette(palette, paletteSize, fallback) {
    const out = [];
    const seen = new Set();
    const add = c => {
      if (!c)
        return;
      const r = clamp8(c[0]), g = clamp8(c[1]), b = clamp8(c[2]), a = clamp8(c[3] == null ? 255 : c[3]);
      const key = (r << 16) | (g << 8) | b;
      if (seen.has(key))
        return;
      seen.add(key);
      out.push([r, g, b, a]);
    };
    if (Array.isArray(palette))
      for (const c of palette) add(c);
    if (Array.isArray(fallback))
      for (const c of fallback) {
        if (out.length >= paletteSize)
          break;
        add(c);
      }
    while (out.length < paletteSize)
      out.push([0, 0, 0, 255]);
    return out.slice(0, paletteSize);
  }

  function buildUniformPalette(paletteSize) {
    const out = [];
    if (paletteSize <= 2) {
      out.push([0, 0, 0, 255], [255, 255, 255, 255]);
      return out.slice(0, paletteSize);
    }
    const levels = Math.ceil(Math.cbrt(paletteSize));
    for (let r = 0; r < levels; ++r)
      for (let g = 0; g < levels; ++g)
        for (let b = 0; b < levels; ++b) {
          out.push([
            Math.round((r * 255) / Math.max(1, levels - 1)),
            Math.round((g * 255) / Math.max(1, levels - 1)),
            Math.round((b * 255) / Math.max(1, levels - 1)),
            255
          ]);
          if (out.length >= paletteSize)
            return out;
        }
    return out;
  }

  function buildWebSafePalette(paletteSize) {
    const steps = [0, 51, 102, 153, 204, 255];
    if (paletteSize >= 216) {
      const full = [];
      for (const r of steps)
        for (const g of steps)
          for (const b of steps)
            full.push([r, g, b, 255]);
      return full;
    }
    const levels = Math.max(2, Math.min(6, Math.ceil(Math.cbrt(Math.max(2, paletteSize)))));
    const pick = [];
    for (let i = 0; i < levels; ++i)
      pick.push(Math.floor(i * 5 / Math.max(1, levels - 1)));
    const out = [];
    for (const ri of pick)
      for (const gi of pick)
        for (const bi of pick) {
          out.push([steps[ri], steps[gi], steps[bi], 255]);
          if (out.length >= paletteSize)
            return out;
        }
    return out;
  }

  function buildEga16Palette() {
    return [
      [0, 0, 0, 255], [0, 0, 170, 255], [0, 170, 0, 255], [0, 170, 170, 255],
      [170, 0, 0, 255], [170, 0, 170, 255], [170, 85, 0, 255], [170, 170, 170, 255],
      [85, 85, 85, 255], [85, 85, 255, 255], [85, 255, 85, 255], [85, 255, 255, 255],
      [255, 85, 85, 255], [255, 85, 255, 255], [255, 255, 85, 255], [255, 255, 255, 255]
    ];
  }

  function buildVga256Palette() {
    const out = [...buildEga16Palette(), ...buildWebSafePalette(216)];
    for (let i = 0; i < 24; ++i) {
      const v = 8 + i * 10;
      out.push([v, v, v, 255]);
    }
    return out;
  }

  function buildMac8BitPalette() {
    const rg = [0, 36, 73, 109, 146, 182, 219, 255];
    const b = [0, 85, 170, 255];
    const out = [];
    for (const r of rg)
      for (const g of rg)
        for (const bb of b)
          out.push([r, g, bb, 255]);
    return out;
  }

  function buildCga4Palette(mode) {
    switch (mode) {
      case 'CGA4_Palette0Low': return [[0, 0, 0, 255], [0, 170, 0, 255], [170, 0, 0, 255], [170, 85, 0, 255]];
      case 'CGA4_Palette0High': return [[0, 0, 0, 255], [85, 255, 85, 255], [255, 85, 85, 255], [255, 255, 85, 255]];
      case 'CGA4_Palette1Low': return [[0, 0, 0, 255], [0, 170, 170, 255], [170, 0, 170, 255], [170, 170, 170, 255]];
      case 'CGA4_Palette1High': return [[0, 0, 0, 255], [85, 255, 255, 255], [255, 85, 255, 255], [255, 255, 255, 255]];
      case 'CGA4_Palette2Low': return [[0, 0, 0, 255], [0, 170, 170, 255], [170, 0, 0, 255], [170, 170, 170, 255]];
      case 'CGA4_Palette2High':
      default: return [[0, 0, 0, 255], [85, 255, 255, 255], [255, 85, 85, 255], [255, 255, 255, 255]];
    }
  }

  function buildCgaComposite16Palette() {
    return [
      [0x00, 0x00, 0x00, 255], [0x00, 0x6E, 0x2D, 255], [0x2D, 0x02, 0xFF, 255], [0x00, 0x8B, 0xFF, 255],
      [0xA9, 0x00, 0x2D, 255], [0x77, 0x76, 0x77, 255], [0xEC, 0x09, 0xFF, 255], [0xBB, 0x92, 0xFD, 255],
      [0x2D, 0x5A, 0x00, 255], [0x00, 0xDC, 0x00, 255], [0x76, 0x77, 0x77, 255], [0x45, 0xF4, 0xB9, 255],
      [0xEA, 0x65, 0x02, 255], [0xBC, 0xE5, 0x00, 255], [0xFF, 0x80, 0xBC, 255], [0xFF, 0xFF, 0xFF, 255]
    ];
  }

  function buildMonochromePalette() {
    return [[0, 0, 0, 255], [255, 255, 255, 255]];
  }

  function buildGrayscalePalette(levels) {
    const n = Math.max(2, levels | 0);
    const out = new Array(n);
    for (let i = 0; i < n; ++i) {
      const v = Math.round((i * 255) / (n - 1));
      out[i] = [v, v, v, 255];
    }
    return out;
  }

  function buildPopularityPalette(imageLike, maxColors) {
    const pixels = collectOpaquePixels(imageLike);
    const bins = new Map();
    for (const p of pixels) {
      const key = ((p[0] >> 3) << 10) | ((p[1] >> 3) << 5) | (p[2] >> 3);
      let item = bins.get(key);
      if (!item) {
        item = { count: 0, r: 0, g: 0, b: 0 };
        bins.set(key, item);
      }
      item.count++;
      item.r += p[0];
      item.g += p[1];
      item.b += p[2];
    }
    return [...bins.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, maxColors)
      .map(v => [Math.round(v.r / v.count), Math.round(v.g / v.count), Math.round(v.b / v.count), 255]);
  }

  function buildMedianCutPalette(imageLike, maxColors, varianceMode) {
    const pixels = collectOpaquePixels(imageLike);
    if (pixels.length === 0)
      return [];
    const boxes = [{ pixels }];

    const stats = (arr, c) => {
      let lo = 255, hi = 0, sum = 0, sum2 = 0;
      for (const p of arr) {
        const v = p[c];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
        sum += v;
        sum2 += v * v;
      }
      const n = arr.length || 1;
      const mean = sum / n;
      return { range: hi - lo, variance: (sum2 / n) - mean * mean };
    };

    while (boxes.length < maxColors) {
      let bestIdx = -1;
      let bestScore = -1;
      let splitChannel = 0;
      for (let i = 0; i < boxes.length; ++i) {
        const arr = boxes[i].pixels;
        if (arr.length < 2)
          continue;
        const rs = stats(arr, 0), gs = stats(arr, 1), bs = stats(arr, 2);
        const rv = varianceMode ? rs.variance : rs.range;
        const gv = varianceMode ? gs.variance : gs.range;
        const bv = varianceMode ? bs.variance : bs.range;
        const score = Math.max(rv, gv, bv);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
          splitChannel = rv >= gv && rv >= bv ? 0 : (gv >= bv ? 1 : 2);
        }
      }
      if (bestIdx < 0)
        break;
      const bucket = boxes[bestIdx].pixels.slice().sort((a, b) => a[splitChannel] - b[splitChannel]);
      const mid = bucket.length >> 1;
      if (mid <= 0 || mid >= bucket.length)
        break;
      boxes.splice(bestIdx, 1, { pixels: bucket.slice(0, mid) }, { pixels: bucket.slice(mid) });
    }

    return boxes.map(box => {
      let r = 0, g = 0, b = 0;
      for (const p of box.pixels) {
        r += p[0];
        g += p[1];
        b += p[2];
      }
      const n = Math.max(1, box.pixels.length);
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n), 255];
    });
  }

  function buildOctreePalette(imageLike, maxColors) {
    const pixels = collectOpaquePixels(imageLike, 131072);
    if (pixels.length === 0)
      return [];
    const buckets = new Map();
    for (const p of pixels) {
      const key = ((p[0] >> 4) << 8) | ((p[1] >> 4) << 4) | (p[2] >> 4);
      let b = buckets.get(key);
      if (!b) {
        b = { c: 0, r: 0, g: 0, b: 0 };
        buckets.set(key, b);
      }
      b.c++;
      b.r += p[0];
      b.g += p[1];
      b.b += p[2];
    }
    return [...buckets.values()]
      .sort((a, b) => b.c - a.c)
      .slice(0, maxColors)
      .map(v => [Math.round(v.r / v.c), Math.round(v.g / v.c), Math.round(v.b / v.c), 255]);
  }

  function buildKMeansPalette(imageLike, maxColors, rounds = 8) {
    const pixels = collectOpaquePixels(imageLike, 65536);
    if (pixels.length === 0)
      return [];
    const init = buildPopularityPalette(imageLike, maxColors);
    const centers = init.length > 0
      ? init.map(c => [c[0], c[1], c[2]])
      : buildUniformPalette(maxColors).map(c => [c[0], c[1], c[2]]);
    while (centers.length < maxColors)
      centers.push([...centers[centers.length % Math.max(1, centers.length)]]);

    for (let iter = 0; iter < rounds; ++iter) {
      const sums = new Array(maxColors).fill(0).map(() => [0, 0, 0, 0]);
      for (const p of pixels) {
        let bi = 0, bd = Infinity;
        for (let i = 0; i < maxColors; ++i) {
          const c = centers[i];
          const dr = p[0] - c[0], dg = p[1] - c[1], db = p[2] - c[2];
          const d = dr * dr + dg * dg + db * db;
          if (d < bd) {
            bd = d;
            bi = i;
          }
        }
        const s = sums[bi];
        s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
      }
      for (let i = 0; i < maxColors; ++i) {
        const s = sums[i];
        if (s[3] > 0)
          centers[i] = [Math.round(s[0] / s[3]), Math.round(s[1] / s[3]), Math.round(s[2] / s[3])];
      }
    }

    return centers.map(c => [clamp8(c[0]), clamp8(c[1]), clamp8(c[2]), 255]);
  }

  function createIndexedPalette(args) {
    const imageLike = args.bitmap || args.imageData;
    const quantizer = resolveQuantizer(args.quantizer || 'MedianCut');
    const paletteSize = args.paletteSize | 0;
    const currentPalette = args.currentPalette || [];
    const fallbackPalette = args.fallbackPalette || [];

    let raw;
    switch (quantizer) {
      case 'keep': raw = currentPalette; break;
      case 'Uniform': raw = buildUniformPalette(paletteSize); break;
      case 'WebSafe': raw = buildWebSafePalette(paletteSize); break;
      case 'EGA16': raw = buildEga16Palette().slice(0, paletteSize); break;
      case 'VGA256': raw = buildVga256Palette().slice(0, paletteSize); break;
      case 'Mac8Bit': raw = buildMac8BitPalette().slice(0, paletteSize); break;
      case 'Monochrome': raw = buildMonochromePalette().slice(0, paletteSize); break;
      case 'Grayscale': raw = buildGrayscalePalette(paletteSize); break;
      case 'Custom': raw = currentPalette && currentPalette.length ? currentPalette : fallbackPalette; break;
      case 'CGA4_Palette0Low':
      case 'CGA4_Palette0High':
      case 'CGA4_Palette1Low':
      case 'CGA4_Palette1High':
      case 'CGA4_Palette2Low':
      case 'CGA4_Palette2High':
        raw = buildCga4Palette(quantizer).slice(0, paletteSize); break;
      case 'CGAComposite16_Default':
        raw = buildCgaComposite16Palette().slice(0, paletteSize); break;
      case 'Popularity':
        raw = buildPopularityPalette(imageLike, paletteSize); break;
      case 'Octree':
      case 'EnhancedOctree':
        raw = buildOctreePalette(imageLike, paletteSize); break;
      case 'KMeans':
      case 'IncrementalKMeans':
      case 'BisectingKMeans':
      case 'KMeansRefinement':
      case 'FuzzyCMeans':
      case 'GeneticCMeans':
      case 'GaussianMixture':
      case 'HierarchicalCL':
      case 'Adu':
      case 'Huffman':
      case 'SpatialColor':
      case 'ColorQuantizationNetwork':
      case 'OctreeSOM':
      case 'NeuQuant':
      case 'PngQuant':
      case 'PcaPreprocessor':
      case 'AcoRefinement':
        raw = buildKMeansPalette(imageLike, paletteSize); break;
      case 'VarianceCut':
      case 'VarianceBased':
      case 'BinarySplitting':
      case 'BitReduction':
        raw = buildMedianCutPalette(imageLike, paletteSize, true); break;
      case 'Wu':
      case 'MedianCut':
      default: raw = buildMedianCutPalette(imageLike, paletteSize, false); break;
    }
    return normalizePalette(raw, paletteSize, fallbackPalette);
  }

  function makeBayer(size) {
    if (size === 2)
      return [[0, 2], [3, 1]];
    const half = size >> 1;
    const prev = makeBayer(half);
    const out = new Array(size);
    for (let y = 0; y < size; ++y) out[y] = new Array(size);
    for (let y = 0; y < half; ++y)
      for (let x = 0; x < half; ++x) {
        const v = prev[y][x] * 4;
        out[y][x] = v;
        out[y][x + half] = v + 2;
        out[y + half][x] = v + 3;
        out[y + half][x + half] = v + 1;
      }
    return out;
  }
  ORDERED_MATRICES.bayer16.matrix = makeBayer(16);

  function quantizeNoDither(data, width, height, palette) {
    for (let i = 0; i < width * height * 4; i += 4) {
      if (data[i + 3] < 128) {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
        continue;
      }
      const idx = nearestPaletteIndex(palette, data[i], data[i + 1], data[i + 2], 255);
      const p = palette[idx];
      data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
    }
  }

  function ditherOrdered(data, width, height, palette, cfg) {
    const m = cfg.matrix;
    const mh = m.length;
    const mw = m[0].length;
    const maxv = mw * mh - 1;
    const strength = cfg.strength || 48;
    for (let y = 0; y < height; ++y)
      for (let x = 0; x < width; ++x) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 128) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
          continue;
        }
        const t = ((m[y % mh][x % mw] - (maxv / 2)) / (maxv + 1)) * strength;
        const r = clamp8(data[i] + t), g = clamp8(data[i + 1] + t), b = clamp8(data[i + 2] + t);
        const idx = nearestPaletteIndex(palette, r, g, b, 255);
        const p = palette[idx];
        data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
      }
  }

  function ditherErrorDiffusion(data, width, height, palette, kernel, serpentine = true) {
    const er = new Float32Array(width * height);
    const eg = new Float32Array(width * height);
    const eb = new Float32Array(width * height);
    for (let y = 0; y < height; ++y) {
      const serp = serpentine && ((y & 1) === 1);
      const xs = serp ? width - 1 : 0;
      const xe = serp ? -1 : width;
      const xd = serp ? -1 : 1;
      for (let x = xs; x !== xe; x += xd) {
        const pi = y * width + x;
        const i = pi * 4;
        if (data[i + 3] < 128) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
          continue;
        }
        const rr = clamp8(data[i] + er[pi]);
        const gg = clamp8(data[i + 1] + eg[pi]);
        const bb = clamp8(data[i + 2] + eb[pi]);
        const idx = nearestPaletteIndex(palette, rr, gg, bb, 255);
        const p = palette[idx];
        data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
        const dr = rr - p[0], dg = gg - p[1], db = bb - p[2];
        for (const k of kernel.data) {
          const dx = serp ? -k[0] : k[0];
          const nx = x + dx;
          const ny = y + k[1];
          if (nx < 0 || nx >= width || ny < 0 || ny >= height)
            continue;
          const ni = ny * width + nx;
          const w = k[2] / kernel.divisor;
          er[ni] += dr * w; eg[ni] += dg * w; eb[ni] += db * w;
        }
      }
    }
  }

  function _findSecondClosestPaletteIndex(palette, r, g, b, exclude) {
    let best = exclude === 0 ? 1 : 0;
    let bestDist = Infinity;
    for (let i = 0; i < palette.length; ++i) {
      if (i === exclude)
        continue;
      const p = palette[i];
      const dr = r - p[0], dg = g - p[1], db = b - p[2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  function ditherYliluoma(data, width, height, palette, algorithm = 1) {
    const matrix = ORDERED_MATRICES.bayer8.matrix;
    for (let y = 0; y < height; ++y)
      for (let x = 0; x < width; ++x) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 128) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
          continue;
        }
        const threshold = matrix[y & 7][x & 7] / 64;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const a = 255;
        const idx1 = nearestPaletteIndex(palette, r, g, b, a);
        if (algorithm === 1 || algorithm === 2) {
          const idx2 = _findSecondClosestPaletteIndex(palette, r, g, b, idx1);
          const p1 = palette[idx1], p2 = palette[idx2];
          const d1 = Math.abs(r - p1[0]) + Math.abs(g - p1[1]) + Math.abs(b - p1[2]);
          const d2 = Math.abs(r - p2[0]) + Math.abs(g - p2[1]) + Math.abs(b - p2[2]);
          const ratio = (d1 + d2) > 0 ? d1 / (d1 + d2) : 0;
          const pos = algorithm === 2 ? (((x * 3 + y * 7) & 15) / 16) : 0;
          const pick2 = ((threshold + pos * 0.3) % 1) > (1 - ratio);
          const p = pick2 ? p2 : p1;
          data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
          continue;
        }
        if (algorithm === 3 || algorithm === 4) {
          const candidateCount = algorithm === 3 ? 4 : 8;
          const cands = [];
          for (let pi = 0; pi < palette.length; ++pi) {
            const p = palette[pi];
            const dr = r - p[0], dg = g - p[1], db = b - p[2];
            cands.push({ pi, d: dr * dr + dg * dg + db * db });
          }
          cands.sort((l, r2) => l.d - r2.d);
          const selected = cands.slice(0, Math.min(candidateCount, cands.length));
          const t = threshold + (algorithm === 3 ? (Math.sin((x * 0.1 + y * 0.13) * Math.PI * 2) * 0.1) : 0);
          const idx = selected[Math.max(0, Math.min(selected.length - 1, Math.floor((((t % 1) + 1) % 1) * selected.length)))].pi;
          const p = palette[idx];
          data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
          continue;
        }
      }
  }

  function hilbertIndexToXY(index, n) {
    let x = 0, y = 0;
    let t = index;
    let s = 1;
    while (s < n) {
      const rx = 1 & (t >> 1);
      const ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) {
          x = s - 1 - x;
          y = s - 1 - y;
        }
        const tx = x; x = y; y = tx;
      }
      x += s * rx;
      y += s * ry;
      t >>= 2;
      s <<= 1;
    }
    return [x, y];
  }

  function buildRiemersmaPath(width, height, mode) {
    const pts = [];
    if (mode === 'linear') {
      for (let y = 0; y < height; ++y)
        if ((y & 1) === 0)
          for (let x = 0; x < width; ++x) pts.push([x, y]);
        else
          for (let x = width - 1; x >= 0; --x) pts.push([x, y]);
      return pts;
    }
    if (mode === 'peano')
      return buildRiemersmaPath(width, height, 'linear');

    let n = 1;
    while (n < Math.max(width, height))
      n <<= 1;
    for (let i = 0; i < n * n; ++i) {
      const xy = hilbertIndexToXY(i, n);
      if (xy[0] < width && xy[1] < height)
        pts.push(xy);
    }
    return pts;
  }

  function ditherRiemersma(data, width, height, palette, historySize = 16, curve = 'hilbert') {
    const path = buildRiemersmaPath(width, height, curve);
    const hs = Math.max(1, historySize | 0);
    const h1 = new Float32Array(hs);
    const h2 = new Float32Array(hs);
    const h3 = new Float32Array(hs);
    let hp = 0;

    for (const pt of path) {
      const x = pt[0], y = pt[1];
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
        continue;
      }
      let e1 = 0, e2 = 0, e3 = 0;
      for (let k = 0; k < hs; ++k) {
        const idx = (hp - k - 1 + hs) % hs;
        const w = Math.exp(-k * 0.1) * 0.5;
        e1 += h1[idx] * w; e2 += h2[idx] * w; e3 += h3[idx] * w;
      }
      const rr = clamp8(data[i] + e1);
      const gg = clamp8(data[i + 1] + e2);
      const bb = clamp8(data[i + 2] + e3);
      const pi = nearestPaletteIndex(palette, rr, gg, bb, 255);
      const p = palette[pi];
      h1[hp] = data[i] - p[0];
      h2[hp] = data[i + 1] - p[1];
      h3[hp] = data[i + 2] - p[2];
      hp = (hp + 1) % hs;
      data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
    }
  }

  function pseudoNoise(x, y, seed) {
    const n = Math.sin((x * 12.9898 + y * 78.233 + seed * 37.719)) * 43758.5453;
    return n - Math.floor(n);
  }

  function ditherNoiseFamily(data, width, height, palette, mode) {
    const amp = mode === 'noise-violet' ? 64 : (mode === 'noise-blue' ? 40 : (mode === 'noise-white' ? 32 : 24));
    for (let y = 0; y < height; ++y)
      for (let x = 0; x < width; ++x) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 128) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
          continue;
        }
        const n0 = pseudoNoise(x, y, 1) - 0.5;
        const n1 = pseudoNoise(x + 11, y + 17, 2) - 0.5;
        let n = n0;
        if (mode === 'noise-pink' || mode === 'noise-brown')
          n = 0.7 * n0 + 0.3 * n1;
        else if (mode === 'noise-violet')
          n = n0 - n1;
        else if (mode === 'noise-grey')
          n = 0.2126 * n0 + 0.7152 * n1 + 0.0722 * (pseudoNoise(x + 31, y + 47, 3) - 0.5);
        const nn = n * amp;
        const idx = nearestPaletteIndex(palette, clamp8(data[i] + nn), clamp8(data[i + 1] + nn), clamp8(data[i + 2] + nn), 255);
        const p = palette[idx];
        data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
      }
  }

  function ditherNClosest(data, width, height, palette, mode) {
    const n = mode === 'nclosest-luminance' ? 6 : (mode === 'nclosest-weighted' ? 5 : 4);
    let rrCounter = 0;
    for (let y = 0; y < height; ++y)
      for (let x = 0; x < width; ++x) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 128) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
          continue;
        }
        const ranked = [];
        for (let pi = 0; pi < palette.length; ++pi) {
          const p = palette[pi];
          const dr = data[i] - p[0], dg = data[i + 1] - p[1], db = data[i + 2] - p[2];
          ranked.push({ pi, d: dr * dr + dg * dg + db * db, l: 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] });
        }
        ranked.sort((a, b) => a.d - b.d);
        const cands = ranked.slice(0, Math.min(n, ranked.length));
        let pick = cands[0].pi;
        if (mode === 'nclosest-roundrobin') {
          pick = cands[rrCounter % cands.length].pi;
          rrCounter++;
        } else if (mode === 'nclosest-luminance') {
          const t = (pseudoNoise(x, y, 9) * 255);
          let best = cands[0];
          let bestDl = Math.abs(best.l - t);
          for (const c of cands) {
            const dl = Math.abs(c.l - t);
            if (dl < bestDl) {
              bestDl = dl;
              best = c;
            }
          }
          pick = best.pi;
        } else if (mode === 'nclosest-weighted' || mode === 'nclosest-default' || mode === 'nclosest-bluenoise') {
          let total = 0;
          for (const c of cands)
            total += 1 / (1 + c.d);
          let r = (mode === 'nclosest-bluenoise' ? pseudoNoise(x, y, 23) : Math.random()) * total;
          for (const c of cands) {
            r -= 1 / (1 + c.d);
            if (r <= 0) {
              pick = c.pi;
              break;
            }
          }
        }
        const p = palette[pick];
        data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
      }
  }

  function ditherNConvex(data, width, height, palette, mode) {
    const base = mode === 'nconvex-projection' ? 'nclosest-luminance'
      : (mode === 'nconvex-weighted' ? 'nclosest-weighted'
        : (mode === 'nconvex-spatial' ? 'nclosest-bluenoise' : 'nclosest-default'));
    ditherNClosest(data, width, height, palette, base);
  }

  function ditherAdaptiveFamily(data, width, height, palette, mode) {
    const varMap = {
      'adaptive-quality': 'jarvis-judice-ninke',
      'adaptive-balanced': 'sierra',
      'adaptive-fast': 'floyd-steinberg',
      'adaptive-smart': 'stucki'
    };
    const kernelId = varMap[mode] || 'sierra';
    ditherErrorDiffusion(data, width, height, palette, ERROR_DIFFUSION[kernelId], true);
  }

  function ditherStyleFamily(data, width, height, palette, mode) {
    const map = {
      'dizzy-default': 'sierra',
      'dizzy-hq': 'stucki',
      'dizzy-fast': 'floyd-steinberg',
      'debanding-default': 'floyd-steinberg',
      'debanding-strong': 'stucki',
      'debanding-gentle': 'none',
      'gradient-aware-default': 'sierra',
      'gradient-aware-soft': 'floyd-steinberg',
      'gradient-aware-strong': 'stucki',
      'adaptive-matrix-default': 'sierra',
      'adaptive-matrix-aggressive': 'stucki',
      'adaptive-matrix-conservative': 'floyd-steinberg',
      'structure-aware-default': 'sierra',
      'structure-aware-priority': 'stucki',
      'structure-aware-large': 'jarvis-judice-ninke',
      'smart-default': 'sierra',
      'smart-hq': 'jarvis-judice-ninke',
      'smart-fast': 'floyd-steinberg'
    };
    const k = map[mode] || 'floyd-steinberg';
    if (k === 'none')
      quantizeNoDither(data, width, height, palette);
    else
      ditherErrorDiffusion(data, width, height, palette, ERROR_DIFFUSION[k], true);
  }

  function ditherArithmetic(data, width, height, palette, mode) {
    for (let y = 0; y < height; ++y)
      for (let x = 0; x < width; ++x) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 128) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
          continue;
        }
        let t = 0;
        if (mode === 'arith-uniform')
          t = 0;
        else if (mode === 'arith-xory149')
          t = (((x ^ (y * 149)) & 255) - 127.5) / 255;
        else if (mode === 'arith-xory149-ch')
          t = ((((x ^ (y * 149) ^ (data[i] >> 2)) & 255) - 127.5) / 255);
        else if (mode === 'arith-xy')
          t = ((((x + y * 3) & 255) - 127.5) / 255);
        else if (mode === 'arith-xy-ch')
          t = ((((x + y * 3 + (data[i + 1] >> 2)) & 255) - 127.5) / 255);
        const n = t * 48;
        const idx = nearestPaletteIndex(palette, clamp8(data[i] + n), clamp8(data[i + 1] + n), clamp8(data[i + 2] + n), 255);
        const p = palette[idx];
        data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
      }
  }

  const _matrixCache = new Map();

  function _matrixKey(kind, size) {
    return kind + ':' + size;
  }

  function _calcBinaryEnergy(binary, size, px, py, wantOnes) {
    const sigma = size / 4;
    const sigmaSq2 = 2 * sigma * sigma;
    let energy = 0;
    const half = Math.floor(size / 2);
    for (let dy = -half; dy <= half; ++dy)
      for (let dx = -half; dx <= half; ++dx) {
        if (dx === 0 && dy === 0)
          continue;
        const nx = (px + dx + size) % size;
        const ny = (py + dy + size) % size;
        const ni = ny * size + nx;
        if (!!binary[ni] !== !!wantOnes)
          continue;
        const distSq = dx * dx + dy * dy;
        energy += Math.exp(-distSq / sigmaSq2);
      }
    return energy;
  }

  function _generateVoidClusterRankMatrix(size) {
    const total = size * size;
    const binary = new Uint8Array(total);
    const rank = new Int32Array(total);
    const initialOnes = total >> 1;

    let count = 0;
    for (let y = 0; y < size; ++y)
      for (let x = 0; x < size; ++x) {
        if (((x + y) & 1) === 0 && count < initialOnes) {
          binary[y * size + x] = 1;
          count++;
        }
      }

    let currentRank = initialOnes - 1;
    while (count > 0) {
      let best = -1;
      let bestEnergy = -Infinity;
      for (let y = 0; y < size; ++y)
        for (let x = 0; x < size; ++x) {
          const i = y * size + x;
          if (!binary[i])
            continue;
          const e = _calcBinaryEnergy(binary, size, x, y, true);
          if (e > bestEnergy) {
            bestEnergy = e;
            best = i;
          }
        }
      if (best < 0)
        break;
      binary[best] = 0;
      rank[best] = currentRank--;
      count--;
    }

    binary.fill(0);
    count = 0;
    for (let y = 0; y < size; ++y)
      for (let x = 0; x < size; ++x) {
        if (((x + y) & 1) === 0 && count < initialOnes) {
          binary[y * size + x] = 1;
          count++;
        }
      }

    currentRank = initialOnes;
    while (count < total) {
      let best = -1;
      let bestEnergy = -Infinity;
      for (let y = 0; y < size; ++y)
        for (let x = 0; x < size; ++x) {
          const i = y * size + x;
          if (binary[i])
            continue;
          const e = _calcBinaryEnergy(binary, size, x, y, false);
          if (e > bestEnergy) {
            bestEnergy = e;
            best = i;
          }
        }
      if (best < 0)
        break;
      binary[best] = 1;
      rank[best] = currentRank++;
      count++;
    }
    return rank;
  }

  function _getThresholdMatrix(kind, size) {
    const key = _matrixKey(kind, size);
    const cached = _matrixCache.get(key);
    if (cached)
      return cached;
    const rank = _generateVoidClusterRankMatrix(size);
    const total = size * size;
    const matrix = new Float32Array(total);
    for (let i = 0; i < total; ++i)
      matrix[i] = ((rank[i] + 0.5) / total) - 0.5;
    _matrixCache.set(key, matrix);
    return matrix;
  }

  function ditherThresholdMatrix(data, width, height, palette, matrix, size) {
    for (let y = 0; y < height; ++y)
      for (let x = 0; x < width; ++x) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 128) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
          continue;
        }
        const t = matrix[(y % size) * size + (x % size)];
        const idx = nearestPaletteIndex(palette, clamp8(data[i] + t * 255), clamp8(data[i + 1] + t * 255), clamp8(data[i + 2] + t * 255), 255);
        const p = palette[idx];
        data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
      }
  }

  function ditherDbs(data, width, height, palette, iterations) {
    const iters = Math.max(1, iterations | 0);
    const totalPx = width * height;
    const assign = new Uint16Array(totalPx);
    for (let p = 0; p < totalPx; ++p) {
      const i = p * 4;
      if (data[i + 3] < 128) {
        assign[p] = 0xffff;
        continue;
      }
      assign[p] = nearestPaletteIndex(palette, data[i], data[i + 1], data[i + 2], 255);
    }

    const kernelRadius = 3;
    const sigma = 1.5;
    const gk = [];
    let gsum = 0;
    for (let dy = -kernelRadius; dy <= kernelRadius; ++dy)
      for (let dx = -kernelRadius; dx <= kernelRadius; ++dx) {
        const v = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        gk.push([dx, dy, v]);
        gsum += v;
      }
    for (const k of gk) k[2] /= gsum;

    function localError(cx, cy) {
      let err = 0;
      for (const k of gk) {
        const x = cx + k[0], y = cy + k[1];
        if (x < 0 || x >= width || y < 0 || y >= height)
          continue;
        const p = y * width + x;
        if (assign[p] === 0xffff)
          continue;
        const pi = assign[p];
        const color = palette[pi];
        const i = p * 4;
        const dr = data[i] - color[0];
        const dg = data[i + 1] - color[1];
        const db = data[i + 2] - color[2];
        const e = 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db;
        err += e * k[2];
      }
      return err;
    }

    const coords = new Array(totalPx);
    for (let y = 0, t = 0; y < height; ++y)
      for (let x = 0; x < width; ++x, ++t)
        coords[t] = [x, y];

    for (let it = 0; it < iters; ++it) {
      for (let i = coords.length - 1; i > 0; --i) {
        const j = (Math.random() * (i + 1)) | 0;
        const tmp = coords[i]; coords[i] = coords[j]; coords[j] = tmp;
      }
      let improved = false;
      for (const c of coords) {
        const x = c[0], y = c[1];
        const p = y * width + x;
        if (assign[p] === 0xffff)
          continue;
        const current = assign[p];
        let best = current;
        let bestErr = localError(x, y);
        for (let ni = 0; ni < palette.length; ++ni) {
          if (ni === current)
            continue;
          assign[p] = ni;
          const e = localError(x, y);
          if (e + 1e-10 < bestErr) {
            bestErr = e;
            best = ni;
            improved = true;
          }
        }
        assign[p] = best;
      }
      if (!improved)
        break;
    }

    for (let p = 0; p < totalPx; ++p) {
      const i = p * 4;
      const pi = assign[p];
      if (pi === 0xffff) {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
        continue;
      }
      const c = palette[pi];
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }

  function quantizeToPalette(args) {
    const src = args.bitmap || args.imageData;
    const palette = args.palette || [];
    const dither = resolveDither(args.dither || 'none');
    if (!src || palette.length === 0)
      return;

    const img = toImageData(src);
    if (!img)
      return;
    const data = img.data;
    const w = img.width;
    const h = img.height;

    if (dither === 'none')
      quantizeNoDither(data, w, h, palette);
    else if (dither === 'blue-noise-8' || dither === 'blue-noise-64' || dither === 'blue-noise-128') {
      const size = dither === 'blue-noise-8' ? 8 : (dither === 'blue-noise-64' ? 64 : 128);
      ditherThresholdMatrix(data, w, h, palette, _getThresholdMatrix('blue', size), size);
    }
    else if (dither === 'void-cluster-4' || dither === 'void-cluster-8' || dither === 'void-cluster-16' || dither === 'void-cluster-32') {
      const size = dither === 'void-cluster-4' ? 4 : (dither === 'void-cluster-8' ? 8 : (dither === 'void-cluster-16' ? 16 : 32));
      ditherThresholdMatrix(data, w, h, palette, _getThresholdMatrix('void', size), size);
    }
    else if (dither === 'dbs-1' || dither === 'dbs-3' || dither === 'dbs-5' || dither === 'dbs-10') {
      const iterations = dither === 'dbs-1' ? 1 : (dither === 'dbs-3' ? 3 : (dither === 'dbs-5' ? 5 : 10));
      ditherDbs(data, w, h, palette, iterations);
    }
    else if (dither === 'ostromoukhov' || dither === 'ostromoukhov-linear') {
      const k = dither === 'ostromoukhov' ? ERROR_DIFFUSION.sierra : ERROR_DIFFUSION['floyd-steinberg'];
      ditherErrorDiffusion(data, w, h, palette, k, dither !== 'ostromoukhov-linear');
    }
    else if (dither === 'arith-xory149' || dither === 'arith-xory149-ch' || dither === 'arith-xy' || dither === 'arith-xy-ch' || dither === 'arith-uniform')
      ditherArithmetic(data, w, h, palette, dither);
    else if (dither === 'nclosest-default' || dither === 'nclosest-weighted' || dither === 'nclosest-roundrobin' || dither === 'nclosest-luminance' || dither === 'nclosest-bluenoise')
      ditherNClosest(data, w, h, palette, dither);
    else if (dither === 'nconvex-default' || dither === 'nconvex-projection' || dither === 'nconvex-spatial' || dither === 'nconvex-weighted')
      ditherNConvex(data, w, h, palette, dither);
    else if (dither === 'adaptive-quality' || dither === 'adaptive-balanced' || dither === 'adaptive-fast' || dither === 'adaptive-smart')
      ditherAdaptiveFamily(data, w, h, palette, dither);
    else if (
      dither === 'dizzy-default' || dither === 'dizzy-hq' || dither === 'dizzy-fast' ||
      dither === 'debanding-default' || dither === 'debanding-strong' || dither === 'debanding-gentle' ||
      dither === 'gradient-aware-default' || dither === 'gradient-aware-soft' || dither === 'gradient-aware-strong' ||
      dither === 'adaptive-matrix-default' || dither === 'adaptive-matrix-aggressive' || dither === 'adaptive-matrix-conservative' ||
      dither === 'structure-aware-default' || dither === 'structure-aware-priority' || dither === 'structure-aware-large' ||
      dither === 'smart-default' || dither === 'smart-hq' || dither === 'smart-fast'
    )
      ditherStyleFamily(data, w, h, palette, dither);
    else if (dither === 'yliluoma-1' || dither === 'yliluoma-2' || dither === 'yliluoma-3' || dither === 'yliluoma-4')
      ditherYliluoma(data, w, h, palette, dither === 'yliluoma-1' ? 1 : (dither === 'yliluoma-2' ? 2 : (dither === 'yliluoma-3' ? 3 : 4)));
    else if (dither === 'riemersma-hilbert-16' || dither === 'riemersma-hilbert-8' || dither === 'riemersma-hilbert-32' || dither === 'riemersma-linear-16' || dither === 'riemersma-peano-16') {
      const hs = dither === 'riemersma-hilbert-8' ? 8 : (dither === 'riemersma-hilbert-32' ? 32 : 16);
      const curve = dither === 'riemersma-linear-16' ? 'linear' : (dither === 'riemersma-peano-16' ? 'peano' : 'hilbert');
      ditherRiemersma(data, w, h, palette, hs, curve);
    }
    else if (
      dither === 'noise-white' || dither === 'noise-blue' || dither === 'noise-pink' ||
      dither === 'noise-brown' || dither === 'noise-violet' || dither === 'noise-grey'
    )
      ditherNoiseFamily(data, w, h, palette, dither);
    else if (dither === 'random' || dither === 'random-light' || dither === 'random-strong') {
      const amp = dither === 'random-light' ? 16 : (dither === 'random-strong' ? 56 : 32);
      for (let i = 0; i < w * h * 4; i += 4) {
        if (data[i + 3] < 128) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
          continue;
        }
        const n = (Math.random() - 0.5) * amp;
        const idx = nearestPaletteIndex(palette, clamp8(data[i] + n), clamp8(data[i + 1] + n), clamp8(data[i + 2] + n), 255);
        const p = palette[idx];
        data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
      }
    } else if (dither === 'ign' || dither === 'ign-light' || dither === 'ign-strong') {
      const amp = dither === 'ign-light' ? 20 : (dither === 'ign-strong' ? 52 : 36);
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const i = (y * w + x) * 4;
          if (data[i + 3] < 128) {
            data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
            continue;
          }
          const ign = ((52.9829189 * (((x * 0.06711056) + (y * 0.00583715)) % 1)) % 1) - 0.5;
          const n = ign * amp;
          const idx = nearestPaletteIndex(palette, clamp8(data[i] + n), clamp8(data[i + 1] + n), clamp8(data[i + 2] + n), 255);
          const p = palette[idx];
          data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
        }
    }
    else if (ORDERED_MATRICES[dither])
      ditherOrdered(data, w, h, palette, ORDERED_MATRICES[dither]);
    else
      ditherErrorDiffusion(data, w, h, palette, ERROR_DIFFUSION[dither] || ERROR_DIFFUSION['floyd-steinberg'], true);

    if (args.bitmap && Bitmap && args.bitmap instanceof Bitmap) {
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const i = (y * w + x) * 4;
          args.bitmap.setPixelRGBA(x, y, data[i], data[i + 1], data[i + 2], data[i + 3]);
        }
    } else if (args.imageData && args.imageData.data && args.imageData.data !== data)
      args.imageData.data.set(data);
  }

  Drawing.Quantization = {
    getQuantizers() { return QUANTIZER_OPTIONS.slice(); },
    getDitherers() { return DITHER_OPTIONS.slice(); },
    nearestPaletteIndex,
    createIndexedPalette,
    quantizeToPalette,
    countDistinctOpaqueColors
  };
})(window);
