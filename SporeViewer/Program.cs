using Photino.NET;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;

namespace SporeViewer
{
    class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            ArgumentNullException.ThrowIfNull(args);

            string windowTitle = "spore viewer";
            var window = new PhotinoWindow()
                .SetLogVerbosity(0)
                .SetTitle(windowTitle)
                .SetUseOsDefaultSize(false)
                .SetSize(new System.Drawing.Size(1024, 800))
                .Center()
                .SetResizable(false)
                .RegisterWebMessageReceivedHandler((sender, message) =>
                {
                    if (message == "load")
                    {
                        var window = sender as PhotinoWindow;
                        Image image = Image.Load("../../../../dev/resources/elp_usaf_target/4x_G2E2_0p.png");
                        window?.SendWebMessage(image.ToBase64String(PngFormat.Instance));
                    }
                    else
                    {
                        Console.WriteLine(message);
                    }
                })
                .Load("wwwroot/index.html");
            window.WaitForClose();
        }
    }
}
