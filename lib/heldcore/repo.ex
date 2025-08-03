defmodule Heldcore.Repo do
  use Ecto.Repo,
    otp_app: :heldcore,
    adapter: Ecto.Adapters.Postgres
end
