// ai.js — KI läuft direkt auf dem Handy (transformers.js).
// Modelle werden beim ersten Upload einmal geladen und danach vom Browser gecacht.
//   Ausschneiden:  briaai/RMBG-1.4  (~44 MB)
//   Kategorie:     CLIP zero-shot   (~90 MB)

const WardroAI = (() => {
    const LIB_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';
    let lib = null;
    let bgModel = null, bgProcessor = null;
    let classifier = null;

    // Englische Beschreibungen für CLIP → unsere Kategorien
    const LABELS = {
        'a hat, cap or beanie':                                  'head',
        'a shirt, t-shirt, hoodie, sweater or jacket':           'torso',
        'pants, jeans, shorts or a skirt':                       'legs',
        'shoes, sneakers or boots':                              'shoes',
        'an accessory like a watch, bag, necklace, sunglasses or belt': 'accessory',
    };

    async function loadLib() {
        if (!lib) {
            lib = await import(LIB_URL);
            lib.env.allowLocalModels = false;
        }
        return lib;
    }

    // Fortschritt über alle Dateien eines Modells zusammenfassen
    function progressTracker(onProgress) {
        const files = {};
        return (p) => {
            if (p.status === 'progress' && p.total) {
                files[p.file] = { loaded: p.loaded, total: p.total };
                let loaded = 0, total = 0;
                Object.values(files).forEach(f => { loaded += f.loaded; total += f.total; });
                onProgress && onProgress(Math.round(loaded / total * 100));
            }
        };
    }

    async function loadBackgroundModel(onProgress) {
        if (bgModel) return;
        const { AutoModel, AutoProcessor } = await loadLib();
        const progress_callback = progressTracker(onProgress);
        bgModel = await AutoModel.from_pretrained('briaai/RMBG-1.4', {
            config: { model_type: 'custom' },
            dtype: 'q8',
            progress_callback,
        });
        bgProcessor = await AutoProcessor.from_pretrained('briaai/RMBG-1.4', {
            config: {
                do_normalize: true,
                do_pad: false,
                do_rescale: true,
                do_resize: true,
                image_mean: [0.5, 0.5, 0.5],
                feature_extractor_type: 'ImageFeatureExtractor',
                image_std: [1, 1, 1],
                resample: 2,
                rescale_factor: 0.00392156862745098,
                size: { width: 1024, height: 1024 },
            },
        });
    }

    async function loadClassifier(onProgress) {
        if (classifier) return;
        const { pipeline } = await loadLib();
        classifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
            dtype: 'q8',
            progress_callback: progressTracker(onProgress),
        });
    }

    // canvas → neues Canvas mit transparentem Hintergrund
    async function removeBackground(canvas, onProgress) {
        await loadBackgroundModel(onProgress);
        const { RawImage } = lib;
        const image = await RawImage.fromCanvas(canvas);
        const { pixel_values } = await bgProcessor(image);
        const { output } = await bgModel({ input: pixel_values });
        const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8'))
            .resize(canvas.width, canvas.height);

        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;
        const ctx = out.getContext('2d');
        ctx.drawImage(canvas, 0, 0);
        const imgData = ctx.getImageData(0, 0, out.width, out.height);
        for (let i = 0; i < mask.data.length; i++) {
            imgData.data[i * 4 + 3] = mask.data[i];
        }
        ctx.putImageData(imgData, 0, 0);
        return out;
    }

    // canvas (freigestellt) → { category, scores }
    async function classify(canvas, onProgress) {
        await loadClassifier(onProgress);
        // Auf weißem Hintergrund erkennt CLIP Kleidung besser
        const white = document.createElement('canvas');
        white.width = canvas.width;
        white.height = canvas.height;
        const ctx = white.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, white.width, white.height);
        ctx.drawImage(canvas, 0, 0);

        const result = await classifier(white.toDataURL('image/jpeg', 0.9), Object.keys(LABELS));
        const best = result[0];
        return { category: LABELS[best.label], score: best.score };
    }

    return { removeBackground, classify };
})();
