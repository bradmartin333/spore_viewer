import 'dart:async' show Completer;
import 'dart:typed_data' show Uint8List, BytesBuilder;

import 'package:flutter/material.dart';
import 'package:flutter_dropzone/flutter_dropzone.dart';

void main() => runApp(const MyApp());

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late DropzoneViewController dropzoneViewController;
  Uint8List? imageBytes;

  @override
  Widget build(BuildContext context) => MaterialApp(
    home: Scaffold(
      appBar: AppBar(title: const Text('spore viewer')),
      body: Column(
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
            debugPrint('dropzone ${file.name}');
            final bytes = await dropzoneViewController.getFileData(file);
            debugPrint('read bytes with length ${bytes.length}');
            setState(() {
              imageBytes = bytes;
            });
          },
        ),
  );

  Future<Uint8List> collectBytes(Stream<List<int>> source) {
    var bytes = BytesBuilder(copy: false);
    var completer = Completer<Uint8List>.sync();
    source.listen(
      bytes.add,
      onError: completer.completeError,
      onDone: () => completer.complete(bytes.takeBytes()),
      cancelOnError: true,
    );
    return completer.future;
  }
}
