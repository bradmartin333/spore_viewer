import 'package:flutter/material.dart';
import 'package:flutter_dropzone/flutter_dropzone.dart';
import 'package:image/image.dart' as img;
import 'package:flutter/foundation.dart';

void main() => runApp(const MyApp());

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool loadingImage = false;
  late DropzoneViewController dropzoneViewController;
  Uint8List? imageBytes;
  List<int>? histogram;

  @override
  Widget build(BuildContext context) => MaterialApp(
    home: Scaffold(
      appBar: AppBar(title: const Text('spore viewer')),
      body:
          loadingImage
              ? Center(child: Text('loading...'))
              : Column(
                children: [
                  Expanded(
                    child: Container(
                      color: Colors.transparent,
                      child: Stack(
                        children: [
                          buildZone(context),
                          if (imageBytes != null)
                            Center(child: Image.memory(imageBytes!)),
                          if (imageBytes == null)
                            const Center(child: Text('drop image here')),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(
                    height: 100,
                    child: CustomPaint(
                      painter: HistogramPainter(histogram),
                      size: Size.infinite,
                    ),
                  ),
                ],
              ),
    ),
  );

  Widget buildZone(BuildContext context) => Builder(
    builder:
        (context) => DropzoneView(
          operation: DragOperation.copy,
          cursor: CursorType.grab,
          onCreated: (ctrl) => dropzoneViewController = ctrl,
          onError: (error) => debugPrint('dropzone error: $error'),
          onDropFile: (file) async {
            setState(() {
              loadingImage = true;
            });
            debugPrint('dropzone ${file.name}');
            final bytes = await dropzoneViewController.getFileData(file);
            debugPrint('read bytes with length ${bytes.length}');
            final histogramResult = await compute(calculateHistogram, bytes);
            setState(() {
              imageBytes = bytes;
              histogram = histogramResult;
              loadingImage = false;
            });
          },
        ),
  );

  List<int> calculateHistogram(Uint8List bytes) {
    final img.Image? image = img.decodeImage(bytes);
    if (image == null) return List<int>.filled(256, 0);

    final histogram = List<int>.filled(256, 0);
    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final pixel = image.getPixel(x, y);
        final r = pixel.r;
        final g = pixel.g;
        final b = pixel.b;
        final grayscale = ((r + g + b) / 3).round();
        histogram[grayscale]++;
      }
    }
    return histogram;
  }
}

class HistogramPainter extends CustomPainter {
  final List<int>? histogram;

  HistogramPainter(this.histogram);

  @override
  void paint(Canvas canvas, Size size) {
    if (histogram == null) return;

    final paint = Paint()..color = Colors.blue;
    final maxCount = histogram!.reduce((a, b) => a > b ? a : b);
    final barWidth = size.width / histogram!.length;

    for (int i = 0; i < histogram!.length; i++) {
      final barHeight = (histogram![i] / maxCount) * size.height;
      canvas.drawRect(
        Rect.fromLTWH(
          i * barWidth,
          size.height - barHeight,
          barWidth,
          barHeight,
        ),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
