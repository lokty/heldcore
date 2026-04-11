defmodule HeldcoreWeb.ImpressumLive do
  use HeldcoreWeb, :live_view

  def mount(_params, _session, socket) do
    {:ok, assign(socket, page_title: "Impressum")}
  end

  def render(assigns) do
    ~H"""
    <div class="font-['Geist',sans-serif] min-h-screen w-screen bg-[#fff] text-black">
      <div class="max-w-xl mx-auto px-6 py-20">
        <a href="/" class="text-sm text-gray-600 hover:underline">← Back</a>

        <h1 class="text-3xl font-bold mt-8 mb-8">Impressum</h1>

        <p class="text-xs uppercase tracking-wider text-gray-500 mb-3">
          Angaben gemäß § 5 TMG
        </p>

        <div class="space-y-1 text-sm mb-8">
          <p class="font-semibold">Heldcore GmbH</p>
          <p>Falkenried 32F</p>
          <p>20251 Hamburg</p>
          <p>Germany</p>
        </div>

        <div class="space-y-1 text-sm mb-8">
          <p><span class="text-gray-500">Vertreten durch:</span> [TODO: Geschäftsführer]</p>
          <p>
            <span class="text-gray-500">Kontakt:</span>
            <a href="mailto:info@heldcore.com" class="hover:underline">info@heldcore.com</a>
          </p>
        </div>

        <div class="space-y-1 text-sm">
          <p><span class="text-gray-500">Handelsregister:</span> HRB 21610, Amtsgericht Hamburg</p>
          <p><span class="text-gray-500">USt-IdNr.:</span> DE341234567</p>
        </div>
      </div>
    </div>
    """
  end
end
